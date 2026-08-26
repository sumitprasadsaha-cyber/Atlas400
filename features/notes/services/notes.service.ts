import { firestoreService, COLLECTIONS, auditService } from "../../../services/firebase";
import { r2UploadService, r2DownloadService, r2DeleteService, r2ReplaceService, r2SignedUrlService } from "../../../services/r2";
import {
  Note,
  NoteMetadata,
  NoteUploadPayload,
  NoteReplacePayload,
  NoteUpdateMetadataPayload,
  NoteFilters,
} from "../../../shared/types/notes.types";
import { logger } from "../../../shared/utils/logger";
import { validateNoteUploadFile, extractFileExtension, sanitizeVirusSafeFilename } from "../../../shared/validation/note.validator";
import { openPdfWithNativeViewer } from "../../../src/lib/nativePdfService";
import { Unsubscribe } from "firebase/firestore";
import { UserRole } from "../../../shared/types/auth.types";

function normalizeAuditRole(role?: string): UserRole | "system" | "anonymous" {
  if (role === "admin" || role === "super_admin") return "admin";
  if (role === "student") return "student";
  if (role === "system") return "system";
  return "anonymous";
}

export const notesService = {
  /**
   * Fetches all notes matching optional filters and search terms.
   */
  async getNotes(filters?: NoteFilters): Promise<Note[]> {
    try {
      logger.debug("Fetching notes with filters", { filters });
      const rawNotes = await firestoreService.getCollection<Note>(COLLECTIONS.NOTES);

      // In-memory robust filtering for search queries, subjects, chapters, batches, status
      let filtered = (rawNotes || []).filter((note) => {
        if (!note || note.status === "deleted") return false;

        // Visibility filter
        if (filters?.isVisible !== undefined && note.isVisible !== filters.isVisible) {
          return false;
        }

        // Status filter
        if (filters?.status && note.status !== filters.status) {
          return false;
        }

        // Subject filter
        if (filters?.subject && filters.subject !== "all") {
          const noteSub = (note.subject || note.subjectId || "").toLowerCase();
          if (noteSub !== filters.subject.toLowerCase()) return false;
        }

        // Batch filter
        if (filters?.batch && filters.batch !== "all") {
          const noteBatch = (note.batch || note.classId || "").toLowerCase();
          if (noteBatch !== filters.batch.toLowerCase()) return false;
        }

        // Chapter filter
        if (filters?.chapter && filters.chapter !== "all") {
          const noteChap = (note.chapter || note.chapterId || "").toLowerCase();
          if (!noteChap.includes(filters.chapter.toLowerCase())) return false;
        }

        // Class grade filter
        if (filters?.classGrade && filters.classGrade !== "all") {
          const noteClass = (note.class || "").toLowerCase();
          if (noteClass !== filters.classGrade.toLowerCase()) return false;
        }

        // Partial match search query across Title, Subject, Chapter, Batch, Tags, Description
        if (filters?.searchQuery && filters.searchQuery.trim()) {
          const q = filters.searchQuery.trim().toLowerCase();
          const title = (note.title || "").toLowerCase();
          const desc = (note.description || "").toLowerCase();
          const subj = (note.subject || "").toLowerCase();
          const chap = (note.chapter || "").toLowerCase();
          const bat = (note.batch || "").toLowerCase();
          const tags = Array.isArray(note.tags) ? note.tags.join(" ").toLowerCase() : "";
          const fileName = (note.originalFileName || note.fileName || "").toLowerCase();

          const match =
            title.includes(q) ||
            desc.includes(q) ||
            subj.includes(q) ||
            chap.includes(q) ||
            bat.includes(q) ||
            tags.includes(q) ||
            fileName.includes(q);

          if (!match) return false;
        }

        return true;
      });

      // Sorting
      const sortBy = filters?.sortBy || "newest";
      filtered.sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.uploadedAt || (b as any).createdAt || 0).getTime() - new Date(a.uploadedAt || (a as any).createdAt || 0).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.uploadedAt || (a as any).createdAt || 0).getTime() - new Date(b.uploadedAt || (b as any).createdAt || 0).getTime();
        }
        if (sortBy === "recentlyUpdated") {
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        }
        if (sortBy === "downloads") {
          return (b.downloadCount || 0) - (a.downloadCount || 0);
        }
        if (sortBy === "title") {
          return (a.title || "").localeCompare(b.title || "");
        }
        return 0;
      });

      return filtered;
    } catch (error) {
      logger.error("Failed to get notes", error);
      throw error;
    }
  },

  /**
   * Real-time notes subscription.
   */
  subscribeNotes(callback: (notes: Note[]) => void, filters?: NoteFilters): Unsubscribe {
    return firestoreService.subscribeToCollection<Note>(
      COLLECTIONS.NOTES,
      [],
      (docs) => {
        let filtered = (docs || []).filter((note) => {
          if (!note || note.status === "deleted") return false;
          if (filters?.isVisible !== undefined && note.isVisible !== filters.isVisible) return false;
          if (filters?.status && note.status !== filters.status) return false;
          if (filters?.subject && filters.subject !== "all") {
            const noteSub = (note.subject || note.subjectId || "").toLowerCase();
            if (noteSub !== filters.subject.toLowerCase()) return false;
          }
          if (filters?.batch && filters.batch !== "all") {
            const noteBatch = (note.batch || note.classId || "").toLowerCase();
            if (noteBatch !== filters.batch.toLowerCase()) return false;
          }
          if (filters?.searchQuery && filters.searchQuery.trim()) {
            const q = filters.searchQuery.trim().toLowerCase();
            const str = `${note.title} ${note.description || ""} ${note.subject} ${note.chapter || ""} ${note.batch || ""} ${(note.tags || []).join(" ")}`.toLowerCase();
            if (!str.includes(q)) return false;
          }
          return true;
        });

        const sortBy = filters?.sortBy || "newest";
        filtered.sort((a, b) => {
          if (sortBy === "newest") {
            return new Date(b.uploadedAt || (b as any).createdAt || 0).getTime() - new Date(a.uploadedAt || (a as any).createdAt || 0).getTime();
          }
          if (sortBy === "downloads") {
            return (b.downloadCount || 0) - (a.downloadCount || 0);
          }
          return (a.title || "").localeCompare(b.title || "");
        });

        callback(filtered);
      },
      (error) => {
        logger.error("Notes subscription error", error);
      }
    );
  },

  /**
   * Fetches single note by ID.
   */
  async getNoteById(noteId: string): Promise<Note | null> {
    return firestoreService.getDocument<Note>(COLLECTIONS.NOTES, noteId);
  },

  /**
   * Uploads a new note:
   * 1. Validates file size (max 50MB) and supported extension.
   * 2. Uploads binary directly to Cloudflare R2 under notes/{batch}/{subject}/{uuid}.{ext}
   * 3. Stores metadata only in Firestore.
   * 4. Logs audit event: note.upload_completed.
   */
  async uploadNote(payload: NoteUploadPayload, uploadedBy: string, userRole: string = "admin"): Promise<Note> {
    const rawFileName = payload.originalFileName || (payload.file instanceof File ? payload.file.name : "document.pdf");
    const fileSize = payload.file.size;

    logger.info("Initiating Phase 3 Note upload", {
      title: payload.title,
      fileName: rawFileName,
      size: fileSize,
      uploadedBy,
    });

    // 1. Client validation
    const validation = validateNoteUploadFile(fileSize, rawFileName, payload.mimeType);
    if (!validation.isValid) {
      throw new Error(validation.error || "Note validation failed.");
    }

    const batchSlug = payload.batch || payload.classId || "all-batches";
    const subjectSlug = payload.subject || payload.subjectId || "general";

    // 2. Binary Upload to Cloudflare R2
    const uploadResult = await r2UploadService.uploadFile(
      payload.file,
      validation.cleanName,
      `notes/${batchSlug}/${subjectSlug}`,
      validation.cleanMime
    );

    // 3. Metadata persistence to Cloud Firestore
    const noteId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const noteRecord: Note = {
      id: noteId,
      title: payload.title.trim(),
      description: (payload.description || "").trim(),
      subject: payload.subject.trim(),
      chapter: (payload.chapter || payload.chapterId || "").trim(),
      batch: (payload.batch || payload.classId || "All Batches").trim(),
      class: (payload.class || "").trim(),
      tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [],
      fileName: validation.cleanName,
      originalFileName: rawFileName,
      mimeType: uploadResult.mimeType || validation.cleanMime,
      extension: validation.extension || extractFileExtension(rawFileName),
      size: uploadResult.fileSize || fileSize,
      r2ObjectKey: uploadResult.storageKey,
      uploadedBy,
      uploadedAt: nowIso,
      updatedAt: nowIso,
      status: "active",
      downloadCount: 0,
      lastDownloadedAt: null,
      isVisible: true,
      version: 1,

      // Compatibility properties
      classId: payload.classId || payload.batch,
      subjectId: payload.subjectId || payload.subject,
      chapterId: payload.chapterId || payload.chapter,
      topicId: payload.topicId,
      storageKey: uploadResult.storageKey,
      bucket: uploadResult.bucket,
      fileSize: uploadResult.fileSize || fileSize,
    };

    await firestoreService.setDocument(COLLECTIONS.NOTES, noteId, noteRecord);

    // 4. Audit Log Event
    try {
      await auditService.log({
        userId: uploadedBy,
        role: normalizeAuditRole(userRole),
        action: "note.upload_completed",
        resource: `notes/${noteId}`,
        status: "success",
        metadata: {
          noteId,
          title: noteRecord.title,
          r2ObjectKey: noteRecord.r2ObjectKey,
          size: noteRecord.size,
          subject: noteRecord.subject,
          batch: noteRecord.batch,
        },
      });
    } catch (auditErr) {
      logger.warn("Non-blocking audit log failure for note upload", auditErr);
    }

    logger.info("Note uploaded and cataloged successfully", { noteId, r2Key: noteRecord.r2ObjectKey });
    return noteRecord;
  },

  /**
   * Replaces an existing note's binary file:
   * 1. Uploads new file to R2 with fresh unique key.
   * 2. Verifies upload.
   * 3. Deletes previous R2 object permanently.
   * 4. Updates Firestore metadata with incremented version.
   * 5. Logs audit event: note.replaced.
   */
  async replaceNoteFile(payload: NoteReplacePayload, updatedBy: string, userRole: string = "admin"): Promise<Note> {
    const existingNote = await this.getNoteById(payload.noteId);
    if (!existingNote) {
      throw new Error(`Note not found with ID '${payload.noteId}'`);
    }

    const rawFileName = payload.originalFileName || (payload.file instanceof File ? payload.file.name : "document.pdf");
    const validation = validateNoteUploadFile(payload.file.size, rawFileName, payload.mimeType);
    if (!validation.isValid) {
      throw new Error(validation.error || "Replacement file validation failed.");
    }

    logger.info("Executing safe note file replacement", {
      noteId: payload.noteId,
      oldKey: existingNote.r2ObjectKey || existingNote.storageKey,
      newFile: rawFileName,
    });

    const oldKey = existingNote.r2ObjectKey || existingNote.storageKey || "";

    // 1 & 2. Upload new file & delete old file via R2 replace service
    const replaceResult = await r2ReplaceService.replaceFile({
      oldR2ObjectKey: oldKey,
      file: payload.file,
      fileName: validation.cleanName,
      batch: existingNote.batch,
      subject: existingNote.subject,
      mimeType: validation.cleanMime,
      bucket: existingNote.bucket,
    });

    // 3. Update Firestore metadata
    const nowIso = new Date().toISOString();
    const updatedFields: Partial<Note> = {
      r2ObjectKey: replaceResult.r2ObjectKey,
      storageKey: replaceResult.r2ObjectKey,
      fileName: validation.cleanName,
      originalFileName: rawFileName,
      mimeType: replaceResult.mimeType || validation.cleanMime,
      extension: validation.extension,
      size: replaceResult.size,
      fileSize: replaceResult.size,
      version: (existingNote.version || 1) + 1,
      updatedAt: nowIso,
    };

    await firestoreService.updateDocument(COLLECTIONS.NOTES, payload.noteId, updatedFields);

    const updatedNote: Note = {
      ...existingNote,
      ...updatedFields,
    };

    // 4. Audit Log Event
    try {
      await auditService.log({
        userId: updatedBy,
        role: normalizeAuditRole(userRole),
        action: "note.replaced",
        resource: `notes/${payload.noteId}`,
        status: "success",
        metadata: {
          noteId: payload.noteId,
          oldR2ObjectKey: oldKey,
          newR2ObjectKey: replaceResult.r2ObjectKey,
          version: updatedNote.version,
          size: replaceResult.size,
        },
      });
    } catch (auditErr) {
      logger.warn("Non-blocking audit log failure for note replacement", auditErr);
    }

    return updatedNote;
  },

  /**
   * Updates note metadata (title, description, tags, subject, chapter, batch, class).
   */
  async updateNoteMetadata(
    noteId: string,
    metadata: NoteUpdateMetadataPayload,
    updatedBy: string,
    userRole: string = "admin"
  ): Promise<Note> {
    const existing = await this.getNoteById(noteId);
    if (!existing) {
      throw new Error(`Note not found with ID '${noteId}'`);
    }

    const updates: Partial<Note> = {
      ...metadata,
      updatedAt: new Date().toISOString(),
    };

    await firestoreService.updateDocument(COLLECTIONS.NOTES, noteId, updates);

    try {
      await auditService.log({
        userId: updatedBy,
        role: normalizeAuditRole(userRole),
        action: "note.metadata_updated",
        resource: `notes/${noteId}`,
        status: "success",
        metadata: {
          noteId,
          updates,
        },
      });
    } catch {}

    return {
      ...existing,
      ...updates,
    };
  },

  /**
   * Toggles note visibility (Publish / Hide).
   */
  async toggleNoteVisibility(noteId: string, isVisible: boolean, updatedBy: string, userRole: string = "admin"): Promise<void> {
    await firestoreService.updateDocument(COLLECTIONS.NOTES, noteId, {
      isVisible,
      status: isVisible ? "active" : "hidden",
      updatedAt: new Date().toISOString(),
    });

    try {
      await auditService.log({
        userId: updatedBy,
        role: normalizeAuditRole(userRole),
        action: "note.visibility_changed",
        resource: `notes/${noteId}`,
        status: "success",
        metadata: { noteId, isVisible },
      });
    } catch {}
  },

  /**
   * Safely deletes note:
   * 1. Reads note metadata.
   * 2. Deletes binary from Cloudflare R2.
   * 3. Deletes document from Firestore.
   * 4. Logs audit event: note.deleted.
   */
  async deleteNote(noteId: string, deletedBy: string, userRole: string = "admin"): Promise<void> {
    const note = await this.getNoteById(noteId);
    if (!note) {
      logger.warn(`Note '${noteId}' not found for deletion, proceeding with cleanup.`);
      await firestoreService.deleteDocument(COLLECTIONS.NOTES, noteId);
      return;
    }

    const storageKey = note.r2ObjectKey || note.storageKey;
    logger.info("Executing safe atomic note deletion", { noteId, storageKey });

    // 1. Delete R2 binary
    if (storageKey) {
      try {
        await r2DeleteService.deleteFile(storageKey, note.bucket);
      } catch (r2Err) {
        logger.warn(`Failed to delete binary from R2 for note '${noteId}', deleting metadata`, r2Err);
      }
    }

    // 2. Delete Firestore document
    await firestoreService.deleteDocument(COLLECTIONS.NOTES, noteId);

    // 3. Log Audit Event
    try {
      await auditService.log({
        userId: deletedBy,
        role: normalizeAuditRole(userRole),
        action: "note.deleted",
        resource: `notes/${noteId}`,
        status: "success",
        metadata: {
          noteId,
          title: note.title,
          r2ObjectKey: storageKey,
          subject: note.subject,
        },
      });
    } catch {}

    logger.info("Note deleted cleanly from R2 and Firestore", { noteId });
  },

  /**
   * Opens note in native viewer using a temporary 5-minute signed URL.
   * Increments download count and updates lastDownloadedAt in Firestore.
   * Triggers audit log: note.downloaded.
   */
  async openNote(note: Note, userId: string = "anonymous", userRole: string = "student"): Promise<void> {
    const storageKey = note.r2ObjectKey || note.storageKey || "";
    if (!storageKey) {
      throw new Error("Cannot open note: Missing Cloudflare R2 storage key.");
    }

    logger.info("Opening note in native viewer", { noteId: note.id, storageKey, title: note.title });

    // 1. Open in Native Viewer with 5-minute signed URL
    await openPdfWithNativeViewer({
      storageKey,
      noteId: note.id,
      fileName: note.originalFileName || note.fileName,
      mimeType: note.mimeType,
      bucket: note.bucket,
    });

    // 2. Track download analytics in Firestore (non-blocking)
    const newDownloadCount = (note.downloadCount || 0) + 1;
    const nowIso = new Date().toISOString();

    firestoreService
      .updateDocument(COLLECTIONS.NOTES, note.id, {
        downloadCount: newDownloadCount,
        lastDownloadedAt: nowIso,
      })
      .catch((err) => logger.warn("Failed to update note download analytics", err));

    // 3. Audit Log Event (non-blocking)
    auditService
      .log({
        userId,
        role: normalizeAuditRole(userRole),
        action: "note.downloaded",
        resource: `notes/${note.id}`,
        status: "success",
        metadata: {
          noteId: note.id,
          title: note.title,
          r2ObjectKey: storageKey,
          downloadCount: newDownloadCount,
        },
      })
      .catch(() => {});
  },

  /**
   * Generates a direct 5-minute temporary signed download URL.
   */
  async getDownloadUrl(note: Note): Promise<string> {
    const storageKey = note.r2ObjectKey || note.storageKey || "";
    if (!storageKey) {
      throw new Error("Missing storage key on note.");
    }

    const { signedUrl } = await r2SignedUrlService.getSignedUrl(storageKey, note.bucket, 300);
    return signedUrl;
  },

  // Backward compatibility alias
  async getNotesBySubject(classId: string, subjectId: string): Promise<Note[]> {
    return this.getNotes({ batch: classId, subject: subjectId });
  },
};
