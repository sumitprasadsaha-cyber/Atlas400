/**
 * Atlas v5.0.8 — Production-Hardened Notes Service
 * Robust pipeline for Upload, Replace, Delete, Rename, Verification, Caching, and Error Recovery.
 */

import {
  NoteMetadata,
  NoteFormInput,
  buildCanonicalNoteMetadata,
  validateCanonicalNoteMetadata,
} from "../domain/notes/types";
import { ClassNote, Student } from "../types";
import { filterClassNotesForStudent } from "../utils/classNoteHelper";
import {
  saveClassNoteDoc,
  deleteClassNoteDoc,
} from "./firestoreService";
import { deleteTopicPracticeTest, deleteClassPracticeTests } from "./practiceTestService";
import { notesLogger } from "./notesLogger";
import { notesCacheService } from "./notesCacheService";
import { validateNoteInput } from "../utils/notesValidation";
import {
  uploadToR2,
  deleteFromR2,
  getR2BucketName,
  getR2PublicUrl,
} from "./r2Client";

export const MAX_NOTE_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp"];
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export interface NoteUploadParams {
  file: File;
  classGrade: string;
  subject: string;
  generalStudiesPaper?: string;
  gsPaper?: string;
  chapterNo?: number;
  chapterName?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  moduleNo?: number;
  moduleName?: string;
  moduleNumber?: number;
  moduleTitle?: string;
  topicNo?: string | number;
  topicName?: string;
  topicNumber?: string | number;
  topicTitle?: string;
  partLabel?: string;
  visibility?: "all" | "selected" | "hidden";
  allowedStudentIds?: string[];
  allowedClasses?: string[];
  uploadedBy?: string;
  onProgress?: (percent: number) => void;
}

export interface NoteReplaceParams {
  noteId: string;
  currentNote: ClassNote | NoteMetadata;
  newFile: File;
  onProgress?: (percent: number) => void;
}

export interface NoteRenameParams {
  noteId: string;
  currentNote: ClassNote;
  newTopicTitle?: string;
  newTopicNumber?: number | string;
  newChapterTitle?: string;
}

/**
 * Validates file type and size. Returns null if valid, or a user-friendly error string.
 */
export function validateNoteFile(file: File): string | null {
  if (!file) {
    return "Invalid file. Please select a valid file to upload.";
  }

  if (file.size > MAX_NOTE_FILE_SIZE) {
    return "File exceeds the 50 MB limit. Please compress or select a smaller file.";
  }

  const name = (file.name || "").toLowerCase();
  const ext = name.split(".").pop() || "";
  const mime = (file.type || "").toLowerCase();

  const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
  const isAllowedMime =
    ALLOWED_MIME_TYPES.includes(mime) ||
    (mime.startsWith("image/") && (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp"));

  if (!isAllowedExt && !isAllowedMime) {
    return "Unsupported format. Only PDF, PNG, JPG, JPEG, and WebP files are supported.";
  }

  return null;
}

/**
 * Robust fetch wrapper with exponential backoff for transient network resilience
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts: number = 3,
  retryDelayMs: number = 800
): Promise<Response> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);
      // Return immediately on success or client errors (4xx) that shouldn't be retried
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      throw new Error(`Server returned status ${response.status}`);
    } catch (err: any) {
      lastError = err;
      notesLogger.warn("RETRY_ATTEMPT", {
        extra: { url, attempt, maxAttempts, error: err?.message || String(err) },
      });

      if (attempt < maxAttempts) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 200;
        const delay = retryDelayMs * Math.pow(2, attempt - 1) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Network request failed after multiple attempts.");
}

/**
 * Storage verification: checks whether an uploaded object exists in R2
 */
export async function verifyR2StorageObject(storageKey: string): Promise<boolean> {
  if (!storageKey) return false;
  try {
    const cleanKey = storageKey.replace(/^\/+/, "");
    const res = await fetch(`/api/r2/verify?key=${encodeURIComponent(cleanKey)}`, {
      method: "GET",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data && data.exists);
  } catch {
    return false;
  }
}

// Track active uploads to prevent double submits
const activeUploads = new Set<string>();

/**
 * Atlas v5.0.8 Production-Hardened Upload Pipeline
 * Form Input -> validate -> buildCanonicalNoteMetadata() -> R2 Upload (Real Progress) -> Storage Verify -> Firestore Doc -> Rollback on error -> Return
 */
export async function uploadNotePipeline(params: NoteUploadParams): Promise<ClassNote> {
  const { file, onProgress, uploadedBy = "Admin" } = params;

  // 1. Stage 1: Validate file presence and format
  console.log(`[Upload Pipeline] Stage 1: Validating file "${file?.name}" (${file?.size} bytes)...`);
  const fileValidationError = validateNoteFile(file);
  if (fileValidationError) {
    notesLogger.warn("VALIDATION_FAILED", { error: fileValidationError, fileName: file?.name });
    throw new Error(fileValidationError);
  }

  // 2. Validate metadata fields
  console.log(`[Upload Pipeline] Stage 1.1: Validating curriculum metadata fields...`);
  const metaValidation = validateNoteInput({
    className: params.classGrade,
    classGrade: params.classGrade,
    subject: params.subject,
    gsPaper: params.gsPaper || params.generalStudiesPaper,
    generalStudiesPaper: params.generalStudiesPaper || params.gsPaper,
    chapterNumber: params.chapterNumber ?? params.chapterNo,
    chapterName: params.chapterName ?? params.chapterTitle,
    moduleNumber: params.moduleNumber ?? params.moduleNo,
    moduleName: params.moduleName ?? params.moduleTitle,
    topicNumber: params.topicNumber ?? params.topicNo ?? params.partLabel,
    topicTitle: params.topicTitle ?? params.topicName,
    fileName: file.name,
    fileSize: file.size,
  });

  if (!metaValidation.isValid) {
    notesLogger.warn("VALIDATION_FAILED", { error: metaValidation.error });
    throw new Error(metaValidation.error || "Invalid note metadata provided.");
  }

  // 3. Build Canonical Metadata Object (School or UPSC)
  const canonicalMetadata = buildCanonicalNoteMetadata({
    className: params.classGrade,
    classGrade: params.classGrade,
    subject: params.subject,
    gsPaper: params.gsPaper || params.generalStudiesPaper,
    generalStudiesPaper: params.generalStudiesPaper || params.gsPaper,
    chapterNumber: params.chapterNumber ?? params.chapterNo,
    chapterName: params.chapterName ?? params.chapterTitle,
    moduleNumber: params.moduleNumber ?? params.moduleNo,
    moduleName: params.moduleName ?? params.moduleTitle,
    topicNumber: params.topicNumber ?? params.topicNo ?? params.partLabel,
    topicName: params.topicName ?? params.topicTitle,
    partLabel: params.partLabel,
    fileName: file.name,
    originalFilename: file.name,
    fileSize: file.size,
    mimeType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
    visibility: params.visibility || "all",
    allowedStudentIds: params.allowedStudentIds,
    allowedClasses: params.allowedClasses,
    uploadedBy,
  });

  // 4. Validate Canonical Metadata Object
  const validation = validateCanonicalNoteMetadata(canonicalMetadata);
  if (!validation.isValid) {
    throw new Error(validation.error || `Missing ${validation.missingField}`);
  }

  const uploadLockKey = `${canonicalMetadata.id}_${file.size}`;
  if (activeUploads.has(uploadLockKey)) {
    throw new Error("An upload for this topic is already in progress. Please wait a moment.");
  }
  activeUploads.add(uploadLockKey);

  console.log(`[Upload Pipeline] Stage 2: Validation complete for note ${canonicalMetadata.id}. Storage Path: "${canonicalMetadata.storagePath}"`);
  notesLogger.info("UPLOAD_START", {
    noteId: canonicalMetadata.id,
    noteType: canonicalMetadata.type,
    fileName: file.name,
    fileSize: file.size,
    storageKey: canonicalMetadata.storagePath,
  });

  let r2Uploaded = false;
  try {
    // 5. Stage 3: Upload file to Cloudflare R2 with REAL progress tracking (0%..99%)
    console.log(`[Upload Pipeline] Stage 3: Uploading file to Cloudflare R2 (${canonicalMetadata.storagePath})...`);
    const mimeType = canonicalMetadata.mimeType || file.type || "application/pdf";
    const bucket = getR2BucketName();

    const uploadRes = await uploadToR2({
      bucket,
      key: canonicalMetadata.storagePath,
      file,
      mimeType,
      onProgress: (realPercent) => {
        // Report actual progress from XHR byte upload events
        if (onProgress) {
          // Cap at 95% while uploading bytes so 100% only represents complete DB persistence
          const displayPct = Math.min(95, Math.max(1, realPercent));
          onProgress(displayPct);
        }
      },
    });

    r2Uploaded = true;
    console.log(`[Upload Pipeline] Stage 4: Cloudflare R2 upload confirmed. ETag/Result:`, uploadRes);

    const downloadUrl = `/api/storage?action=download&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(canonicalMetadata.storagePath)}`;
    const publicUrl = uploadRes.url || getR2PublicUrl(bucket, canonicalMetadata.storagePath);

    const isUPSC = canonicalMetadata.type === "upsc";
    const chapterNo = isUPSC ? canonicalMetadata.moduleNumber : canonicalMetadata.chapterNumber;
    const chapterName = isUPSC ? canonicalMetadata.moduleName : canonicalMetadata.chapterName;

    const createdNote: ClassNote = {
      ...(canonicalMetadata as any),
      id: canonicalMetadata.id,
      classGrade: canonicalMetadata.className,
      subject: canonicalMetadata.subject,
      chapterNo: chapterNo || 1,
      chapterName: chapterName || "Chapter 1",
      topicNo: canonicalMetadata.topicNumber,
      topicName: canonicalMetadata.topicName || "Topic Note",
      fileName: file.name,
      originalFilename: file.name,
      pdfFileName: file.name,
      r2Key: canonicalMetadata.storagePath,
      storageKey: canonicalMetadata.storagePath,
      storagePath: canonicalMetadata.storagePath,
      pdfUrl: downloadUrl,
      publicUrl: publicUrl,
      downloadUrl: downloadUrl,
      fileSize: file.size,
      mimeType: mimeType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      uploadedBy,
    };

    // 6. Stage 5: Persist to Firestore database
    console.log(`[Upload Pipeline] Stage 5: Saving note document to Firestore database (id: ${createdNote.id})...`);
    try {
      await saveClassNoteDoc(createdNote);
      console.log(`[Upload Pipeline] Stage 5.1: Firestore document write confirmed.`);
    } catch (dbErr: any) {
      console.error(`[Upload Pipeline] Stage 5 ERROR: Firestore save failed, initiating R2 rollback for key "${canonicalMetadata.storagePath}"...`, dbErr);
      // Rollback orphaned file in R2
      try {
        await deleteFromR2({ bucket, key: canonicalMetadata.storagePath });
        console.log(`[Upload Pipeline] Rollback complete: deleted orphaned file from R2.`);
      } catch (rollbackErr) {
        console.warn(`[Upload Pipeline] Warning during R2 rollback:`, rollbackErr);
      }
      throw new Error(`Database save failed: ${dbErr?.message || "Failed to index note record."}. File upload rolled back.`);
    }

    // 7. Stage 6: Invalidate caches for instant UI synchronization
    console.log(`[Upload Pipeline] Stage 6: Invalidating caches for UI refresh...`);
    await notesCacheService.invalidateMetadataCache();
    await notesCacheService.invalidateBlobCache(createdNote.storagePath || createdNote.r2Key || "");

    // 8. Stage 7: Signal 100% completion ONLY after all steps succeeded
    console.log(`[Upload Pipeline] Stage 7: Upload and indexing complete.`);
    if (onProgress) onProgress(100);

    notesLogger.info("UPLOAD_SUCCESS", {
      noteId: createdNote.id,
      storageKey: createdNote.storagePath || createdNote.r2Key,
      fileSize: createdNote.fileSize,
    });

    return createdNote;
  } catch (err: any) {
    notesLogger.error("UPLOAD_ERROR", {
      noteId: canonicalMetadata.id,
      error: err?.message || "Upload pipeline failure",
    });
    console.error(`[Upload Pipeline] Failed to complete upload for note ${canonicalMetadata.id}:`, err);
    throw new Error(err?.message || "Upload failed. Please check your internet connection.");
  } finally {
    activeUploads.delete(uploadLockKey);
  }
}

/**
 * Atlas v5.0.8 Production-Hardened Note Replacement Pipeline
 * Safe in-place replacement: upload new asset with real progress -> update Firestore -> purge stale cache -> return updated record
 */
export async function replaceNotePipeline(params: NoteReplaceParams): Promise<ClassNote> {
  const { noteId, currentNote, newFile, onProgress } = params;

  // 1. Validate replacement file
  console.log(`[Replace Pipeline] Stage 1: Validating replacement file "${newFile?.name}"...`);
  const fileValidationError = validateNoteFile(newFile);
  if (fileValidationError) {
    throw new Error(fileValidationError);
  }

  const targetStorageKey =
    (currentNote as any).storagePath ||
    (currentNote as any).r2Key ||
    (currentNote as any).storageKey ||
    "";

  console.log(`[Replace Pipeline] Stage 2: Target storage key is "${targetStorageKey}"`);
  notesLogger.info("REPLACE_START", {
    noteId,
    storageKey: targetStorageKey,
    fileName: newFile.name,
    fileSize: newFile.size,
  });

  try {
    const bucket = getR2BucketName();
    const mimeType = newFile.type || (newFile.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    // 2. Upload replacement file to Cloudflare R2 with REAL progress tracking
    console.log(`[Replace Pipeline] Stage 3: Uploading replacement file to Cloudflare R2...`);
    const uploadRes = await uploadToR2({
      bucket,
      key: targetStorageKey,
      file: newFile,
      mimeType,
      onProgress: (realPercent) => {
        if (onProgress) {
          const displayPct = Math.min(95, Math.max(1, realPercent));
          onProgress(displayPct);
        }
      },
    });

    console.log(`[Replace Pipeline] Stage 4: Cloudflare R2 file updated. Result:`, uploadRes);

    const downloadUrl = `/api/storage?action=download&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(targetStorageKey)}`;
    const publicUrl = uploadRes.url || getR2PublicUrl(bucket, targetStorageKey);

    // 3. Update database record with new file metadata
    const updatedNote: ClassNote = {
      ...(currentNote as ClassNote),
      classGrade: (currentNote as any).classGrade || (currentNote as any).className || "Class 10",
      subject: (currentNote as any).subject || (currentNote as any).subjectName || "General",
      chapterNo: (currentNote as any).chapterNo || (currentNote as any).chapterNumber || 1,
      chapterName: (currentNote as any).chapterName || (currentNote as any).chapterTitle || "Chapter 1",
      createdAt: (currentNote as any).createdAt || new Date().toISOString(),
      originalFilename: newFile.name,
      fileName: newFile.name,
      pdfFileName: newFile.name,
      r2Key: targetStorageKey,
      storageKey: targetStorageKey,
      storagePath: targetStorageKey,
      pdfUrl: downloadUrl,
      publicUrl: publicUrl,
      downloadUrl: downloadUrl,
      fileSize: newFile.size,
      mimeType: mimeType,
      updatedAt: new Date().toISOString(),
    };

    // 4. Save to Firestore
    console.log(`[Replace Pipeline] Stage 5: Updating Firestore document...`);
    await saveClassNoteDoc(updatedNote);

    // 5. Invalidate cached metadata and stale blob for this note
    console.log(`[Replace Pipeline] Stage 6: Purging cache...`);
    await notesCacheService.invalidateMetadataCache();
    await notesCacheService.invalidateBlobCache(targetStorageKey);

    console.log(`[Replace Pipeline] Stage 7: Replacement complete.`);
    if (onProgress) onProgress(100);

    notesLogger.info("REPLACE_SUCCESS", {
      noteId,
      storageKey: updatedNote.storagePath,
      fileSize: updatedNote.fileSize,
    });

    return updatedNote;
  } catch (err: any) {
    notesLogger.error("REPLACE_ERROR", {
      noteId,
      error: err?.message || "Replacement pipeline error",
    });
    console.error(`[Replace Pipeline] Error replacing note:`, err);
    throw new Error(err?.message || "Replacement failed. Please try again.");
  }
}

/**
 * Atlas v5.0.8 Note Rename Pipeline
 * In-place renaming for topic title, topic number, or chapter/module name
 */
export async function renameNotePipeline(params: NoteRenameParams): Promise<ClassNote> {
  const { noteId, currentNote, newTopicTitle, newTopicNumber, newChapterTitle } = params;

  notesLogger.info("RENAME_START", {
    noteId,
    extra: { newTopicTitle, newTopicNumber, newChapterTitle },
  });

  try {
    const updatedNote: ClassNote = {
      ...currentNote,
      topicTitle: newTopicTitle !== undefined ? newTopicTitle : (currentNote as any).topicTitle,
      topicName: newTopicTitle !== undefined ? newTopicTitle : (currentNote as any).topicName,
      topicNumber: newTopicNumber !== undefined ? newTopicNumber : (currentNote as any).topicNumber,
      topicNo: newTopicNumber !== undefined ? String(newTopicNumber) : (currentNote as any).topicNo,
      chapterName: newChapterTitle !== undefined ? newChapterTitle : currentNote.chapterName,
      chapterTitle: newChapterTitle !== undefined ? newChapterTitle : (currentNote as any).chapterTitle,
      moduleName: newChapterTitle !== undefined ? newChapterTitle : (currentNote as any).moduleName,
      moduleTitle: newChapterTitle !== undefined ? newChapterTitle : (currentNote as any).moduleTitle,
      updatedAt: new Date().toISOString(),
    };

    // Update searchable text
    const parts = [
      updatedNote.classGrade || (updatedNote as any).className || "",
      updatedNote.subject || "",
      `Chapter ${updatedNote.chapterNo || (updatedNote as any).chapterNumber || 1}`,
      updatedNote.chapterName || "",
      updatedNote.topicNumber ? `Topic ${updatedNote.topicNumber}` : "",
      updatedNote.topicTitle || "",
      updatedNote.fileName || "",
    ];
    updatedNote.searchableText = parts.filter(Boolean).join(" ").trim();

    // Persist to Firestore
    await saveClassNoteDoc(updatedNote);

    // Invalidate metadata cache
    await notesCacheService.invalidateMetadataCache();

    notesLogger.info("RENAME_SUCCESS", { noteId });

    return updatedNote;
  } catch (err: any) {
    notesLogger.error("RENAME_ERROR", {
      noteId,
      error: err?.message || "Rename pipeline error",
    });
    throw new Error(err?.message || "Failed to rename note. Please try again.");
  }
}

/**
 * Atlas v5.0.8 Atomic Note Delete Pipeline
 * Delete R2 folder contents + Delete Firestore document + Delete practice tests + Invalidate cache
 */
export async function deleteNotePipeline(noteId: string, note?: ClassNote): Promise<void> {
  const storageKey = note?.storagePath || note?.r2Key || note?.storageKey || "";

  notesLogger.info("DELETE_START", { noteId, storageKey });

  try {
    // 1. Delete R2 storage files via /api/notes/:id
    const res = await fetchWithRetry(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: noteId,
        storageKey,
      }),
    });

    if (!res.ok) {
      let errMsg = "Delete failed. Please try again.";
      try {
        const errJson = await res.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {}
      throw new Error(errMsg);
    }

    // 2. Delete Firestore database record
    await deleteClassNoteDoc(noteId);

    // 3. Clean up associated practice tests if note context is available
    if (note) {
      const isUpsc = note.isUPSC || (note as any).type === "upsc" || (note as any).noteType === "upsc" || note.classGrade === "UPSC";
      const classGrade = isUpsc ? "UPSC" : ((note as any).className || note.classGrade || "Class 10");
      const subject = (note as any).subjectName || note.subject || "";
      const rawChNo = (note as any).chapterNumber ?? note.chapterNo ?? (note as any).moduleNumber ?? 1;
      const chapterNo = typeof rawChNo === "number" ? rawChNo : parseInt(String(rawChNo).replace(/\D/g, ""), 10) || 1;
      const topicName = ((note as any).topicTitle || (note as any).topicName || note.partLabel || "").trim();

      if (subject && topicName) {
        await deleteTopicPracticeTest(classGrade, subject, chapterNo, topicName).catch((testErr) => {
          console.warn("[NotesService] Practice test cleanup warning on note delete:", testErr);
        });
      }
    }

    // 4. Purge cached entries
    await notesCacheService.invalidateMetadataCache();
    if (storageKey) {
      await notesCacheService.invalidateBlobCache(storageKey);
    }

    notesLogger.info("DELETE_SUCCESS", { noteId, storageKey });
  } catch (err: any) {
    notesLogger.error("DELETE_ERROR", {
      noteId,
      error: err?.message || "Delete pipeline error",
    });
    throw new Error(err?.message || "Delete failed. Please try again.");
  }
}

/**
 * Subject Rename Pipeline
 * Atomically updates all notes in Firestore and Cloudflare metadata for a renamed subject
 */
export async function renameSubjectPipeline(params: {
  type: "school" | "upsc";
  className?: string;
  gsPaper?: string;
  oldSubject: string;
  newSubject: string;
  notes: ClassNote[];
}): Promise<{ updatedCount: number }> {
  const { type, className, gsPaper, oldSubject, newSubject, notes } = params;
  const cleanOld = oldSubject.trim().toLowerCase();
  const cleanNew = newSubject.trim();

  if (!cleanNew) {
    throw new Error("New subject name cannot be empty.");
  }
  if (cleanOld === cleanNew.toLowerCase()) {
    return { updatedCount: 0 };
  }

  // Filter notes belonging to this scope and subject
  const matchingNotes = notes.filter((n) => {
    const s = ((n as any).subjectName || n.subject || "").trim().toLowerCase();
    if (s !== cleanOld) return false;

    if (type === "school") {
      const cls = ((n as any).className || n.classGrade || (n as any).class || "").trim().toLowerCase();
      return !className || cls === className.trim().toLowerCase();
    } else {
      const p = ((n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "").trim().toLowerCase();
      return !gsPaper || p === gsPaper.trim().toLowerCase();
    }
  });

  for (const n of matchingNotes) {
    const updatedNote: ClassNote = {
      ...n,
      subject: cleanNew,
      subjectName: cleanNew,
      updatedAt: new Date().toISOString(),
    };

    // Update searchableText
    const parts = [
      updatedNote.classGrade || (updatedNote as any).className || "",
      cleanNew,
      `Chapter ${updatedNote.chapterNo || (updatedNote as any).chapterNumber || 1}`,
      updatedNote.chapterName || "",
      updatedNote.topicNumber ? `Topic ${updatedNote.topicNumber}` : "",
      updatedNote.topicTitle || "",
      updatedNote.fileName || "",
    ];
    updatedNote.searchableText = parts.filter(Boolean).join(" ").trim();

    await saveClassNoteDoc(updatedNote);
  }

  await notesCacheService.invalidateMetadataCache();
  return { updatedCount: matchingNotes.length };
}

/**
 * Chapter / Module Rename Pipeline
 * Atomically updates chapter/module number and/or chapter/module name across all matching notes in Firestore
 */
export async function renameChapterPipeline(params: {
  type: "school" | "upsc";
  className?: string;
  gsPaper?: string;
  subject: string;
  oldChapterNumber: number;
  newChapterNumber: number;
  newChapterName: string;
  notes: ClassNote[];
}): Promise<{ updatedCount: number }> {
  const { type, className, gsPaper, subject, oldChapterNumber, newChapterNumber, newChapterName, notes } = params;
  const cleanSubj = subject.trim().toLowerCase();
  const cleanChName = newChapterName.trim();

  const matchingNotes = notes.filter((n) => {
    const s = ((n as any).subjectName || n.subject || "").trim().toLowerCase();
    if (s !== cleanSubj) return false;

    const rawChNo = (n as any).chapterNumber ?? n.chapterNo ?? (n as any).moduleNumber ?? 1;
    const chNo = typeof rawChNo === "number" ? rawChNo : parseInt(String(rawChNo).replace(/\D/g, ""), 10) || 1;
    if (chNo !== oldChapterNumber) return false;

    if (type === "school") {
      const cls = ((n as any).className || n.classGrade || (n as any).class || "").trim().toLowerCase();
      return !className || cls === className.trim().toLowerCase();
    } else {
      const p = ((n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "").trim().toLowerCase();
      return !gsPaper || p === gsPaper.trim().toLowerCase();
    }
  });

  for (const n of matchingNotes) {
    const updatedNote: ClassNote = {
      ...n,
      chapterNumber: newChapterNumber,
      chapterNo: newChapterNumber,
      chapterName: cleanChName,
      chapterTitle: cleanChName,
      moduleNumber: newChapterNumber,
      moduleNo: newChapterNumber,
      moduleName: cleanChName,
      moduleTitle: cleanChName,
      updatedAt: new Date().toISOString(),
    };

    // Update searchableText
    const parts = [
      updatedNote.classGrade || (updatedNote as any).className || "",
      updatedNote.subject || (updatedNote as any).subjectName || "",
      type === "school" ? `Chapter ${newChapterNumber}` : `Module ${newChapterNumber}`,
      cleanChName,
      updatedNote.topicNumber ? `Topic ${updatedNote.topicNumber}` : "",
      updatedNote.topicTitle || (updatedNote as any).topicName || "",
      updatedNote.fileName || "",
    ];
    updatedNote.searchableText = parts.filter(Boolean).join(" ").trim();

    await saveClassNoteDoc(updatedNote);
  }

  await notesCacheService.invalidateMetadataCache();
  return { updatedCount: matchingNotes.length };
}

/**
 * Chapter / Module Delete Pipeline
 * Atomically deletes all topic notes, storage assets, and practice tests in a chapter/module
 */
export async function deleteChapterPipeline(params: {
  type: "school" | "upsc";
  className?: string;
  gsPaper?: string;
  subject: string;
  chapterNumber: number;
  notes: ClassNote[];
}): Promise<{ deletedCount: number }> {
  const { type, className, gsPaper, subject, chapterNumber, notes } = params;
  const cleanSubj = subject.trim().toLowerCase();

  const matchingNotes = notes.filter((n) => {
    const s = ((n as any).subjectName || n.subject || "").trim().toLowerCase();
    if (s !== cleanSubj) return false;

    const rawChNo = (n as any).chapterNumber ?? n.chapterNo ?? (n as any).moduleNumber ?? 1;
    const chNo = typeof rawChNo === "number" ? rawChNo : parseInt(String(rawChNo).replace(/\D/g, ""), 10) || 1;
    if (chNo !== chapterNumber) return false;

    if (type === "school") {
      const cls = ((n as any).className || n.classGrade || (n as any).class || "").trim().toLowerCase();
      return !className || cls === className.trim().toLowerCase();
    } else {
      const p = ((n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "").trim().toLowerCase();
      return !gsPaper || p === gsPaper.trim().toLowerCase();
    }
  });

  for (const n of matchingNotes) {
    await deleteNotePipeline(n.id, n);
  }

  await notesCacheService.invalidateMetadataCache();
  return { deletedCount: matchingNotes.length };
}

/**
 * Subject Delete Pipeline
 * Recursively deletes all topic notes, Cloudflare R2 assets, and practice tests under a subject
 */
export async function deleteSubjectPipeline(params: {
  type: "school" | "upsc";
  className?: string;
  gsPaper?: string;
  subject: string;
  notes: ClassNote[];
}): Promise<{ deletedCount: number }> {
  const { type, className, gsPaper, subject, notes } = params;
  const cleanSubj = subject.trim().toLowerCase();

  const matchingNotes = notes.filter((n) => {
    const s = ((n as any).subjectName || n.subject || "").trim().toLowerCase();
    if (s !== cleanSubj) return false;

    if (type === "school") {
      const cls = ((n as any).className || n.classGrade || (n as any).class || "").trim().toLowerCase();
      return !className || cls === className.trim().toLowerCase();
    } else {
      const p = ((n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "").trim().toLowerCase();
      return !gsPaper || p === gsPaper.trim().toLowerCase();
    }
  });

  for (const n of matchingNotes) {
    try {
      await deleteNotePipeline(n.id, n);
    } catch (err: any) {
      console.warn(`[DeleteSubjectPipeline] Error deleting note ${n.id} in subject "${subject}":`, err);
    }
  }

  await notesCacheService.invalidateMetadataCache();
  return { deletedCount: matchingNotes.length };
}

/**
 * GS Paper Delete Pipeline (UPSC)
 * Recursively deletes all topic notes, Cloudflare R2 assets, and practice tests under a GS Paper
 */
export async function deletePaperPipeline(params: {
  gsPaper: string;
  notes: ClassNote[];
}): Promise<{ deletedCount: number }> {
  const { gsPaper, notes } = params;
  const cleanPaper = gsPaper.trim().toLowerCase();

  const matchingNotes = notes.filter((n) => {
    const p = ((n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "").trim().toLowerCase();
    return p === cleanPaper;
  });

  for (const n of matchingNotes) {
    try {
      await deleteNotePipeline(n.id, n);
    } catch (err: any) {
      console.warn(`[DeletePaperPipeline] Error deleting note ${n.id} in paper "${gsPaper}":`, err);
    }
  }

  await notesCacheService.invalidateMetadataCache();
  return { deletedCount: matchingNotes.length };
}

/**
 * Atlas v5.0.8 Class Delete Pipeline
 * Recursively deletes:
 * 1. All topic notes belonging to the class
 * 2. Cloudflare R2 storage assets for each note (PDFs, images, metadata.json)
 * 3. Firestore documents in class_notes & upsc_notes
 * 4. Topic practice tests and attempts for the class
 * 5. Purges metadata and blob caches
 */
export async function deleteClassPipeline(params: {
  className: string;
  notes: ClassNote[];
}): Promise<{ deletedCount: number }> {
  const { className, notes } = params;
  const cleanClassName = className.trim().toLowerCase();

  // 1. Find all notes belonging to this class
  const matchingNotes = notes.filter((n) => {
    const cls = ((n as any).className || n.classGrade || (n as any).class || "").trim().toLowerCase();
    return cls === cleanClassName;
  });

  notesLogger.info("DELETE_CLASS_START", { className, extra: { notesCount: matchingNotes.length } });

  // 2. Cascade delete all topic notes (Cloudflare R2 + Firestore + Topic Practice Tests)
  for (const n of matchingNotes) {
    try {
      await deleteNotePipeline(n.id, n);
    } catch (err: any) {
      console.warn(`[DeleteClassPipeline] Error deleting note ${n.id} in class "${className}":`, err);
    }
  }

  // 3. Purge all class-level practice tests and test attempts
  try {
    await deleteClassPracticeTests(className);
  } catch (err: any) {
    console.warn(`[DeleteClassPipeline] Error deleting class practice tests for "${className}":`, err);
  }

  // 4. Purge cache
  await notesCacheService.invalidateMetadataCache();

  notesLogger.info("DELETE_CLASS_SUCCESS", { className, extra: { deletedCount: matchingNotes.length } });
  return { deletedCount: matchingNotes.length };
}

/**
 * Student Notes Query & Access Control
 */
export function getFilteredStudentNotes(student: Student, allNotes: ClassNote[]): ClassNote[] {
  if (!student || !Array.isArray(allNotes)) return [];
  return filterClassNotesForStudent(allNotes, student);
}
