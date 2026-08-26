import { Note, NoteUploadPayload, NoteStatus } from "../types/notes.types";
import { ValidationError } from "../errors";

export const MAX_NOTE_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const SUPPORTED_NOTE_EXTENSIONS = [
  "pdf",
  "png",
  "jpeg",
  "jpg",
  "webp",
  "gif",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "zip",
] as const;

export type SupportedNoteExtension = (typeof SUPPORTED_NOTE_EXTENSIONS)[number];

export const EXTENSION_MIME_MAP: Record<SupportedNoteExtension, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  zip: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
};

export const MIME_TO_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

/**
 * Sanitizes a filename to ensure it is virus/injection-safe:
 * - Strips directory traversals (../, ./)
 * - Strips control characters and null bytes
 * - Blocks executable file extensions (.exe, .sh, .bat, .cmd, .js, .vbs, .bin)
 * - Replaces unsafe characters with underscores
 */
export function sanitizeVirusSafeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "document.pdf";
  }

  // Remove directory traversal sequences and absolute paths
  let clean = filename.replace(/^.*[\\\/]/, "").trim();

  // Strip null bytes and control characters
  clean = clean.replace(/[\x00-\x1f\x80-\x9f]/g, "");

  // Detect and reject malicious double extensions (e.g. file.pdf.exe)
  const forbiddenExts = [
    ".exe", ".bat", ".cmd", ".sh", ".bash", ".bin", ".dll", ".so", ".dylib",
    ".js", ".mjs", ".vbs", ".ps1", ".py", ".php", ".cgi", ".jar", ".com"
  ];
  const lower = clean.toLowerCase();
  for (const badExt of forbiddenExts) {
    if (lower.endsWith(badExt)) {
      throw new ValidationError(`Dangerous file extension '${badExt}' is strictly forbidden.`);
    }
  }

  // Keep only alphanumeric characters, periods, hyphens, and underscores
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Prevent hidden dot-files
  if (clean.startsWith(".")) {
    clean = "note_" + clean.substring(1);
  }

  // Length clamp
  if (clean.length > 120) {
    const ext = extractFileExtension(clean);
    const base = clean.substring(0, 100);
    clean = `${base}.${ext}`;
  }

  return clean || "document.pdf";
}

/**
 * Extracts normalized file extension (without dot).
 */
export function extractFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "pdf";
  return parts.pop()?.toLowerCase().trim() || "pdf";
}

/**
 * Normalizes batch or subject for storage slug path.
 */
export function slugifyStorageSegment(segment: string): string {
  if (!segment) return "general";
  const slug = segment
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "general";
}

/**
 * Generates a unique, non-overwriting R2 Object Key:
 * notes/{batch}/{subject}/{uuid}.{ext}
 */
export function generateR2ObjectKey(batch: string, subject: string, extension: string, uuid?: string): string {
  const cleanBatch = slugifyStorageSegment(batch || "all-batches");
  const cleanSubject = slugifyStorageSegment(subject || "general");
  const cleanExt = (extension || "pdf").toLowerCase().replace(/^\./, "");
  const uniqueId = uuid || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  return `notes/${cleanBatch}/${cleanSubject}/${uniqueId}.${cleanExt}`;
}

/**
 * Validates note file upload requirements.
 */
export function validateNoteUploadFile(
  fileSize: number,
  filename: string,
  mimeType?: string
): { isValid: boolean; extension: string; cleanMime: string; cleanName: string; error?: string } {
  if (fileSize <= 0) {
    return { isValid: false, extension: "", cleanMime: "", cleanName: "", error: "Uploaded file cannot be empty." };
  }

  if (fileSize > MAX_NOTE_FILE_SIZE_BYTES) {
    const mb = Math.round(fileSize / (1024 * 1024));
    return {
      isValid: false,
      extension: "",
      cleanMime: "",
      cleanName: "",
      error: `File size (${mb}MB) exceeds the maximum allowed limit of 50MB.`,
    };
  }

  const cleanName = sanitizeVirusSafeFilename(filename);
  const ext = extractFileExtension(cleanName) as SupportedNoteExtension;

  if (!SUPPORTED_NOTE_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      extension: ext,
      cleanMime: "",
      cleanName,
      error: `Unsupported file extension '.${ext}'. Allowed extensions: ${SUPPORTED_NOTE_EXTENSIONS.join(", ")}`,
    };
  }

  let cleanMime = (mimeType || "").split(";")[0].trim().toLowerCase();
  if (!cleanMime || cleanMime === "application/octet-stream") {
    cleanMime = EXTENSION_MIME_MAP[ext]?.[0] || "application/pdf";
  }

  return {
    isValid: true,
    extension: ext,
    cleanMime,
    cleanName,
  };
}

/**
 * Validates Firestore Note Document
 */
export function isValidNoteDoc(data: unknown): data is Note {
  if (!data || typeof data !== "object") return false;
  const n = data as Partial<Note>;

  return (
    typeof n.id === "string" &&
    n.id.length > 0 &&
    typeof n.title === "string" &&
    n.title.length > 0 &&
    typeof n.subject === "string" &&
    typeof n.r2ObjectKey === "string" &&
    n.r2ObjectKey.length > 0 &&
    typeof n.size === "number" &&
    n.size > 0 &&
    typeof n.isVisible === "boolean" &&
    typeof n.downloadCount === "number" &&
    ["active", "hidden", "deleted"].includes(n.status as string)
  );
}
