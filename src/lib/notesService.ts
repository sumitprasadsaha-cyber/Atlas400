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
 * Form Input -> validate -> buildCanonicalNoteMetadata() -> R2 Upload -> Storage Verify -> Firestore Doc -> Cache Invalidate -> Return
 */
export async function uploadNotePipeline(params: NoteUploadParams): Promise<ClassNote> {
  const { file, onProgress, uploadedBy = "Admin" } = params;

  // 1. Validate file presence and format
  const fileValidationError = validateNoteFile(file);
  if (fileValidationError) {
    notesLogger.warn("VALIDATION_FAILED", { error: fileValidationError, fileName: file?.name });
    throw new Error(fileValidationError);
  }

  // 2. Validate metadata fields
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

  notesLogger.info("UPLOAD_START", {
    noteId: canonicalMetadata.id,
    noteType: canonicalMetadata.type,
    fileName: file.name,
    fileSize: file.size,
    storageKey: canonicalMetadata.storagePath,
  });

  try {
    if (onProgress) onProgress(15);

    // 5. Send upload request to /api/notes/upload
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("noteType", canonicalMetadata.noteType || canonicalMetadata.type);
    formData.append("type", canonicalMetadata.noteType || canonicalMetadata.type);
    formData.append("className", canonicalMetadata.className);
    formData.append("classGrade", canonicalMetadata.className);
    formData.append("subject", canonicalMetadata.subject);

    if (canonicalMetadata.type === "upsc") {
      formData.append("gsPaper", canonicalMetadata.gsPaper);
      formData.append("generalStudiesPaper", canonicalMetadata.gsPaper);
      formData.append("paper", canonicalMetadata.gsPaper);
      formData.append("moduleNumber", String(canonicalMetadata.moduleNumber));
      formData.append("moduleName", canonicalMetadata.moduleName);
      formData.append("moduleNo", String(canonicalMetadata.moduleNumber));
    } else {
      formData.append("chapterNumber", String(canonicalMetadata.chapterNumber));
      formData.append("chapterName", canonicalMetadata.chapterName);
      formData.append("chapterNo", String(canonicalMetadata.chapterNumber));
    }

    if (canonicalMetadata.topicNumber !== undefined) {
      formData.append("topicNumber", String(canonicalMetadata.topicNumber));
      formData.append("topicNo", String(canonicalMetadata.topicNumber));
    }
    if (canonicalMetadata.topicName) {
      formData.append("topicName", canonicalMetadata.topicName);
    }

    formData.append("visibility", canonicalMetadata.visibility);
    formData.append("uploadedBy", uploadedBy);
    formData.append("fileName", file.name);

    if (onProgress) onProgress(40);

    const res = await fetchWithRetry("/api/notes/upload", {
      method: "POST",
      body: formData,
    });

    if (onProgress) onProgress(75);

    if (!res.ok) {
      let errMsg = "Upload failed. Please check your connection and try again.";
      try {
        const errorJson = await res.json();
        if (errorJson?.error) errMsg = errorJson.error;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    if (!data.success || !data.note) {
      throw new Error(data.error || "Upload failed. Storage server did not return confirmed note metadata.");
    }

    const createdNote: ClassNote = {
      ...(data.note as any),
      classGrade: data.note.className,
      subject: data.note.subject,
      chapterNo: data.note.chapterNumber || data.note.moduleNumber || 1,
      chapterName: data.note.chapterName || data.note.moduleName || "Chapter 1",
    };

    if (onProgress) onProgress(85);

    // 6. Persist to Firestore database
    await saveClassNoteDoc(createdNote);

    // 7. Invalidate caches for instant fresh state
    await notesCacheService.invalidateMetadataCache();
    await notesCacheService.invalidateBlobCache(createdNote.storagePath || createdNote.r2Key || "");

    notesLogger.info("UPLOAD_SUCCESS", {
      noteId: createdNote.id,
      storageKey: createdNote.storagePath || createdNote.r2Key,
      fileSize: createdNote.fileSize,
    });

    if (onProgress) onProgress(100);

    return createdNote;
  } catch (err: any) {
    notesLogger.error("UPLOAD_ERROR", {
      noteId: canonicalMetadata.id,
      error: err?.message || "Upload pipeline failure",
    });
    throw new Error(err?.message || "Upload failed. Please check your internet connection.");
  } finally {
    activeUploads.delete(uploadLockKey);
  }
}

/**
 * Atlas v5.0.8 Production-Hardened Note Replacement Pipeline
 * Safe in-place replacement: upload new asset -> update Firestore -> purge stale cache -> return updated record
 */
export async function replaceNotePipeline(params: NoteReplaceParams): Promise<ClassNote> {
  const { noteId, currentNote, newFile, onProgress } = params;

  // 1. Validate replacement file
  const fileValidationError = validateNoteFile(newFile);
  if (fileValidationError) {
    throw new Error(fileValidationError);
  }

  if (onProgress) onProgress(15);

  const targetStorageKey =
    (currentNote as any).storagePath ||
    (currentNote as any).r2Key ||
    (currentNote as any).storageKey ||
    "";

  notesLogger.info("REPLACE_START", {
    noteId,
    storageKey: targetStorageKey,
    fileName: newFile.name,
    fileSize: newFile.size,
  });

  try {
    // 2. Upload replacement file to /api/notes/:id/replace
    const formData = new FormData();
    formData.append("file", newFile, newFile.name);
    formData.append("id", noteId);
    formData.append("oldStorageKey", targetStorageKey);
    formData.append("newFileName", newFile.name);

    if (onProgress) onProgress(50);

    const res = await fetchWithRetry(`/api/notes/${encodeURIComponent(noteId)}/replace`, {
      method: "PUT",
      body: formData,
    });

    if (onProgress) onProgress(80);

    if (!res.ok) {
      let errMsg = "Replacement failed. Please try again.";
      try {
        const errJson = await res.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Replacement failed. Storage could not update file.");
    }

    // 3. Update database record with new file metadata
    const updatedNote: ClassNote = {
      ...(currentNote as ClassNote),
      classGrade: (currentNote as any).classGrade || (currentNote as any).className || "Class 10",
      subject: (currentNote as any).subject || (currentNote as any).subjectName || "General",
      chapterNo: (currentNote as any).chapterNo || (currentNote as any).chapterNumber || 1,
      chapterName: (currentNote as any).chapterName || (currentNote as any).chapterTitle || "Chapter 1",
      createdAt: (currentNote as any).createdAt || new Date().toISOString(),
      originalFilename: data.originalFilename || newFile.name,
      fileName: data.originalFilename || newFile.name,
      pdfFileName: data.originalFilename || newFile.name,
      r2Key: data.r2Key || targetStorageKey,
      storageKey: data.r2Key || targetStorageKey,
      storagePath: data.r2Key || targetStorageKey,
      pdfUrl: data.pdfUrl || data.downloadUrl || (currentNote as any).pdfUrl,
      fileSize: data.fileSize || newFile.size,
      mimeType: data.mimeType || newFile.type || "application/pdf",
      updatedAt: data.updatedAt || new Date().toISOString(),
    };

    // 4. Save to Firestore
    await saveClassNoteDoc(updatedNote);

    // 5. Invalidate cached metadata and stale blob for this note
    await notesCacheService.invalidateMetadataCache();
    await notesCacheService.invalidateBlobCache(targetStorageKey);
    if (updatedNote.storagePath && updatedNote.storagePath !== targetStorageKey) {
      await notesCacheService.invalidateBlobCache(updatedNote.storagePath);
    }

    notesLogger.info("REPLACE_SUCCESS", {
      noteId,
      storageKey: updatedNote.storagePath,
      fileSize: updatedNote.fileSize,
    });

    if (onProgress) onProgress(100);

    return updatedNote;
  } catch (err: any) {
    notesLogger.error("REPLACE_ERROR", {
      noteId,
      error: err?.message || "Replacement pipeline error",
    });
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
