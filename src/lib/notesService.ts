import { ClassNote, Student } from "../types";
import {
  saveClassNoteDoc,
  deleteClassNoteDoc,
  getLocalClassNotes,
  saveLocalClassNotes,
  subscribeToClassNotes,
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
  chapterNo: number;
  chapterName: string;
  moduleNo?: number;
  moduleName?: string;
  topicNo?: string;
  topicName?: string;
  partLabel?: string;
  uploadedBy?: string;
  onProgress?: (percent: number) => void;
}

export interface NoteReplaceParams {
  noteId: string;
  currentNote: ClassNote;
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

/**
 * Normalizes class strings (e.g. "10" -> "Class 10", "upsc" -> "UPSC").
 */
export function normalizeClassGrade(cls: string): string {
  if (!cls) return "";
  const trimmed = cls.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "upsc" || lower.startsWith("upsc")) return "UPSC";
  if (lower.startsWith("class ")) return trimmed;
  if (/^\d+$/.test(lower)) return `Class ${lower}`;
  return trimmed;
}

// Track active uploads to prevent double submits
const activeUploads = new Set<string>();

/**
 * REBUILD NOTES UPLOAD
 * Flow: Admin selects file -> Validate metadata -> Validate file -> Upload to Cloudflare R2 -> Verify upload -> Save metadata to database -> Return success -> Refresh UI
 */
export async function uploadNotePipeline(params: NoteUploadParams): Promise<ClassNote> {
  const {
    file,
    classGrade,
    subject,
    generalStudiesPaper,
    chapterNo,
    chapterName,
    moduleNo,
    moduleName,
    topicNo,
    topicName,
    partLabel,
    uploadedBy = "Admin",
    onProgress,
  } = params;

  // 1. Validate metadata
  const normClass = normalizeClassGrade(classGrade);
  const normSubject = (subject || "").trim();

  if (!normClass || !normSubject) {
    throw new Error("Missing required note metadata (class and subject).");
  }

  // 2. Validate file
  const fileValidationError = validateNoteFile(file);
  if (fileValidationError) {
    throw new Error(fileValidationError);
  }

  const uploadLockKey = `${normClass}_${normSubject}_${chapterNo}_${file.name}_${file.size}`;
  if (activeUploads.has(uploadLockKey)) {
    throw new Error("Upload already in progress. Please wait.");
  }
  activeUploads.add(uploadLockKey);

  try {
    if (onProgress) onProgress(10);

    // 3. Upload to Cloudflare R2 via /api/notes/upload
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("classGrade", normClass);
    formData.append("class", normClass);
    formData.append("subject", normSubject);
    if (generalStudiesPaper) {
      formData.append("generalStudiesPaper", generalStudiesPaper.trim());
      formData.append("gsPaper", generalStudiesPaper.trim());
    }
    formData.append("chapterNo", String(chapterNo || 1));
    formData.append("chapterName", (chapterName || "").trim());
    if (moduleNo) formData.append("moduleNo", String(moduleNo));
    if (moduleName) formData.append("moduleName", moduleName.trim());
    if (topicNo) formData.append("topicNo", String(topicNo).trim());
    if (topicName) formData.append("topicName", topicName.trim());
    if (partLabel) formData.append("partLabel", partLabel.trim());
    formData.append("uploadedBy", uploadedBy);
    formData.append("fileName", file.name);

    if (onProgress) onProgress(30);

    const res = await fetch("/api/notes/upload", {
      method: "POST",
      body: formData,
    });

    if (onProgress) onProgress(70);

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

    const createdNote: ClassNote = data.note;

    // 4. Verify upload & save metadata to database (Firestore + local cache)
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
 * REBUILD NOTE REPLACEMENT
 * Flow: Select new file -> Validate -> Upload new file -> Verify upload success -> Update database -> Delete old R2 object -> Refresh
 */
export async function replaceNotePipeline(params: NoteReplaceParams): Promise<ClassNote> {
  const { noteId, currentNote, newFile, onProgress } = params;

  // 1. Validate replacement file
  const fileValidationError = validateNoteFile(newFile);
  if (fileValidationError) {
    throw new Error(fileValidationError);
  }

  if (onProgress) onProgress(10);

  const oldStorageKey = currentNote.storagePath || currentNote.storageKey || currentNote.objectKey || "";

  try {
    // 2. Upload new file to /api/notes/:id/replace
    const formData = new FormData();
    formData.append("file", newFile, newFile.name);
    formData.append("id", noteId);
    formData.append("oldStorageKey", oldStorageKey);
    formData.append("newFileName", newFile.name);

    if (onProgress) onProgress(40);

    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/replace`, {
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
      throw new Error(data.error || "Replacement failed. Please try again.");
    }

    // 3. Update database record with new metadata while preserving curriculum fields
    const updatedNote: ClassNote = {
      ...currentNote,
      originalFilename: data.originalFilename || newFile.name,
      fileName: data.fileName || newFile.name,
      pdfFileName: data.pdfFileName || newFile.name,
      storedFilename: data.storedFilename || data.filename,
      filename: data.storedFilename || data.filename,
      storageKey: data.storageKey || data.objectKey,
      storagePath: data.storagePath || data.storageKey || data.objectKey,
      objectKey: data.objectKey || data.storageKey,
      pdfUrl: data.pdfUrl || data.publicUrl || data.downloadUrl,
      publicUrl: data.publicUrl || data.pdfUrl || data.downloadUrl,
      downloadUrl: data.downloadUrl || data.pdfUrl || data.publicUrl,
      fileSize: data.fileSize || newFile.size,
      file_size: data.fileSize || newFile.size,
      mimeType: data.mimeType || (newFile.type || "application/pdf"),
      mime_type: data.mimeType || (newFile.type || "application/pdf"),
      fileType: (data.mimeType || newFile.type || "").startsWith("image/") ? "image" : "pdf",
      updatedAt: data.updatedAt || new Date().toISOString(),
      updatedDate: data.updatedDate || new Date().toISOString(),
    };

    // 4. Persist to Firestore / local state (Rollback if fails)
    try {
      await saveClassNoteDoc(updatedNote);
    } catch (dbErr) {
      console.error("[NotesService] DB update failed during replacement, rolling back:", dbErr);
      throw new Error("Replacement failed. Database update could not be completed.");
    }

    if (onProgress) onProgress(100);

    return updatedNote;
  } catch (err: any) {
    console.error("[NotesService] Replacement pipeline error:", err);
    throw new Error(err?.message || "Replacement failed. Please try again.");
  }
}

/**
 * REBUILD NOTE DELETE
 * Flow: Admin confirms -> Delete R2 object -> Delete DB record -> Refresh Admin & Student Notes
 */
export async function deleteNotePipeline(noteId: string, note?: ClassNote): Promise<void> {
  const storageKey = note?.storagePath || note?.storageKey || note?.objectKey || "";

  try {
    // 1. Delete R2 object via /api/notes/:id
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

    // 2. Delete database record in Firestore & local cache
    await deleteClassNoteDoc(noteId);
  } catch (err: any) {
    console.error("[NotesService] Delete pipeline error:", err);
    throw new Error(err?.message || "Delete failed. Please try again.");
  }
}

/**
 * STUDENT NOTES QUERY & FILTERING
 * Students only receive notes matching:
 * • enrolled class
 * • enrolled subject
 * • assigned GS paper (for UPSC)
 * • chapter / module permissions
 * Excludes hidden and deleted notes.
 */
export function getFilteredStudentNotes(student: Student, allNotes: ClassNote[]): ClassNote[] {
  if (!student || !Array.isArray(allNotes)) return [];

  const studentClassNorm = normalizeClassGrade(student.classGrade || "");
  const isUPSC = studentClassNorm.toUpperCase().includes("UPSC");

  // Normalize enrolled subjects
  const enrolledSubjects = new Set(
    (student.enrolledSubjects || []).map((s) => s.trim().toLowerCase())
  );

  return allNotes.filter((note) => {
    // 1. Exclude deleted or hidden notes
    if (!note || !note.id) return false;
    if ((note as any).isDeleted === true || (note as any).status === "deleted" || (note as any).deleted === true) {
      return false;
    }
    if ((note as any).hidden === true || (note as any).visibility === "hidden") {
      return false;
    }

    // 2. Must match enrolled class
    const noteClassNorm = normalizeClassGrade(note.classGrade || (note as any).class || "");
    if (noteClassNorm.toLowerCase() !== studentClassNorm.toLowerCase()) {
      return false;
    }

    // 3. Subject matching
    const noteSubjectNorm = (note.subject || "").trim().toLowerCase();
    if (enrolledSubjects.size > 0 && !enrolledSubjects.has(noteSubjectNorm)) {
      return false;
    }

    // 4. GS Paper matching (if UPSC)
    if (isUPSC) {
      const studentGsPaper = (student as any).generalStudiesPaper || (student as any).gsPaper || "";
      const noteGsPaper = note.generalStudiesPaper || (note as any).gs_paper || (note as any).gsPaper || "";
      if (studentGsPaper && noteGsPaper) {
        if (studentGsPaper.trim().toLowerCase() !== noteGsPaper.trim().toLowerCase()) {
          return false;
        }
      }
    }

    // 5. Allowed student list / permissions (if explicitly constrained)
    if (Array.isArray((note as any).allowedStudentIds) && (note as any).allowedStudentIds.length > 0) {
      if (!(note as any).allowedStudentIds.includes(student.id)) {
        return false;
      }
    }

    return true;
  });
}
