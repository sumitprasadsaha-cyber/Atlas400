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

export const MAX_NOTE_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"];
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
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

/**
 * Validates file type and size. Returns null if valid, or a user-friendly error string.
 */
export function validateNoteFile(file: File): string | null {
  if (!file) {
    return "Invalid file. Please select a file to upload.";
  }

  if (file.size > MAX_NOTE_FILE_SIZE) {
    return "File exceeds size limit. Maximum allowed size is 50 MB.";
  }

  const name = file.name.toLowerCase();
  const ext = name.split(".").pop() || "";
  const mime = (file.type || "").toLowerCase();

  const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
  const isAllowedMime = ALLOWED_MIME_TYPES.includes(mime) || (mime.startsWith("image/") && (ext === "png" || ext === "jpg" || ext === "jpeg"));

  if (!isAllowedExt && !isAllowedMime) {
    return "Unsupported file type. Only PDF, PNG, JPG, and JPEG files are supported.";
  }

  return null;
}

// Track active uploads to prevent double submits
const activeUploads = new Set<string>();

/**
 * Atlas400 v5.0.5 Unified Upload Pipeline
 * Form Input -> buildCanonicalNoteMetadata() -> validateCanonicalNoteMetadata() -> Cloudflare R2 Upload -> Firestore Document -> Return
 */
export async function uploadNotePipeline(params: NoteUploadParams): Promise<ClassNote> {
  const { file, onProgress, uploadedBy = "Admin" } = params;

  // 1. Validate file presence and format
  const fileValidationError = validateNoteFile(file);
  if (fileValidationError) {
    throw new Error(fileValidationError);
  }

  // 2. Build Canonical Metadata Object (School or UPSC)
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
    mimeType: file.type || "application/pdf",
    visibility: params.visibility || "all",
    allowedStudentIds: params.allowedStudentIds,
    allowedClasses: params.allowedClasses,
    uploadedBy,
  });

  // 3. Validate Canonical Metadata Object (identifies exact missing field)
  const validation = validateCanonicalNoteMetadata(canonicalMetadata);
  if (!validation.isValid) {
    throw new Error(validation.error || `Missing ${validation.missingField}`);
  }

  const uploadLockKey = `${canonicalMetadata.id}_${file.size}`;
  if (activeUploads.has(uploadLockKey)) {
    throw new Error("Upload already in progress. Please wait.");
  }
  activeUploads.add(uploadLockKey);

  try {
    if (onProgress) onProgress(15);

    // 4. Send upload request to /api/notes/upload
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

    const res = await fetch("/api/notes/upload", {
      method: "POST",
      body: formData,
    });

    if (onProgress) onProgress(75);

    if (!res.ok) {
      let errMsg = "Upload failed. Please try again.";
      try {
        const errorJson = await res.json();
        if (errorJson?.error) errMsg = errorJson.error;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    if (!data.success || !data.note) {
      throw new Error(data.error || "Upload failed. Please try again.");
    }

    const createdNote: ClassNote = {
      ...(data.note as any),
      classGrade: data.note.className,
      subject: data.note.subject,
      chapterNo: data.note.chapterNumber || data.note.moduleNumber || 1,
      chapterName: data.note.chapterName || data.note.moduleName || "Chapter 1",
    };

    // 5. Persist to Firestore database
    await saveClassNoteDoc(createdNote);

    if (onProgress) onProgress(100);

    return createdNote;
  } catch (err: any) {
    console.error("[NotesService] Upload pipeline error:", err);
    throw new Error(err?.message || "Upload failed. Please try again.");
  } finally {
    activeUploads.delete(uploadLockKey);
  }
}

/**
 * Atlas400 v5.0.5 In-Place Note Replacement Pipeline
 */
export async function replaceNotePipeline(params: NoteReplaceParams): Promise<ClassNote> {
  const { noteId, currentNote, newFile, onProgress } = params;

  // 1. Validate replacement file
  const fileValidationError = validateNoteFile(newFile);
  if (fileValidationError) {
    throw new Error(fileValidationError);
  }

  if (onProgress) onProgress(15);

  const targetStorageKey = (currentNote as any).storagePath || (currentNote as any).r2Key || (currentNote as any).storageKey || "";

  try {
    // 2. Upload replacement file to /api/notes/:id/replace
    const formData = new FormData();
    formData.append("file", newFile, newFile.name);
    formData.append("id", noteId);
    formData.append("oldStorageKey", targetStorageKey);
    formData.append("newFileName", newFile.name);

    if (onProgress) onProgress(50);

    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/replace`, {
      method: "PUT",
      body: formData,
    });

    if (onProgress) onProgress(85);

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
      throw new Error(data.error || "Replacement failed. Please try again.");
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

    if (onProgress) onProgress(100);

    return updatedNote;
  } catch (err: any) {
    console.error("[NotesService] Replacement pipeline error:", err);
    throw new Error(err?.message || "Replacement failed. Please try again.");
  }
}

/**
 * Atlas400 v5.0.5 Note Delete Pipeline
 * Delete R2 folder contents + Delete Firestore document
 */
export async function deleteNotePipeline(noteId: string, note?: ClassNote): Promise<void> {
  const storageKey = note?.storagePath || note?.r2Key || note?.storageKey || "";

  try {
    // 1. Delete R2 storage files via /api/notes/:id
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
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
  } catch (err: any) {
    console.error("[NotesService] Delete pipeline error:", err);
    throw new Error(err?.message || "Delete failed. Please try again.");
  }
}

/**
 * Student Notes Query & Access Control
 */
export function getFilteredStudentNotes(student: Student, allNotes: ClassNote[]): ClassNote[] {
  if (!student || !Array.isArray(allNotes)) return [];
  return filterClassNotesForStudent(allNotes, student);
}
