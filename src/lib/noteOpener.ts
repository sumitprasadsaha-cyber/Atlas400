import { getBucketName, sanitizeStoragePath } from "./storageService";
import { getR2SignedUrlDetails, getR2PublicUrl } from "./r2Client";

export interface NoteOpeningTarget {
  url?: string;
  storageKey?: string;
  storagePath?: string;
  pdfUrl?: string;
  bucket?: string;
  fileName?: string;
  pdfFileName?: string;
  mimeType?: string;
  fileType?: string;
  studentId?: string;
  subject?: string;
  noteId?: string;
  title?: string;
}

/**
 * Detects MIME type for note files to ensure correct inline display in native viewers.
 */
export function getNoteMimeType(fileNameOrUrl: string, mimeType?: string, fileType?: string): string {
  if (mimeType && mimeType.trim() && !mimeType.includes("octet-stream")) {
    return mimeType.trim();
  }
  if (fileType === "image") return "image/jpeg";
  const clean = (fileNameOrUrl || "").split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".pdf")) return "application/pdf";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".heic")) return "image/heic";
  if (clean.endsWith(".heif")) return "image/heif";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  return "application/pdf";
}

/**
 * Resolves a direct HTTPS URL to Cloudflare R2 for opening/viewing notes.
 * Strictly guarantees that no serverless endpoint (/api/download, /api/file, /api/storage, /api/r2, /api/proxy) is used.
 */
export async function resolveDirectNoteUrl(target: string | NoteOpeningTarget): Promise<string> {
  let rawUrl = "";
  let storageKey = "";
  let bucket = "academy-connect-files";
  let mimeType = "";
  let fileType = "";
  let fileName = "";

  if (typeof target === "string") {
    rawUrl = target.trim();
  } else if (target && typeof target === "object") {
    rawUrl = (target.url || target.pdfUrl || "").trim();
    storageKey = (
      target.storageKey ||
      target.storagePath ||
      (target as any).storage_path ||
      (target as any).objectKey ||
      (target as any).r2Key ||
      (target as any).key ||
      ""
    ).trim();
    bucket = target.bucket || "academy-connect-files";
    fileName = target.fileName || target.pdfFileName || (target as any).filename || "";
    mimeType = target.mimeType || (target as any).mime_type || "";
    fileType = target.fileType || "";
  }

  // Handle JSON metadata strings if passed as rawUrl
  if (rawUrl.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawUrl);
      storageKey = parsed.storageKey || parsed.storagePath || parsed.objectKey || storageKey;
      rawUrl = parsed.downloadUrl || parsed.url || "";
      if (parsed.bucket) bucket = parsed.bucket;
      if (parsed.mimeType) mimeType = parsed.mimeType;
    } catch {}
  }

  // If already a Data URL or Blob URL (e.g. locally generated PDF), return directly
  if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) {
    return rawUrl;
  }

  // Extract storageKey if rawUrl contains query parameters or relative paths
  if (rawUrl.includes("key=") || rawUrl.includes("storageKey=") || rawUrl.includes("storagePath=")) {
    try {
      const fakeBase = "http://localhost";
      const parsedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `${fakeBase}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`);
      const keyParam = parsedUrl.searchParams.get("key") || parsedUrl.searchParams.get("storageKey") || parsedUrl.searchParams.get("storagePath");
      if (keyParam) {
        storageKey = decodeURIComponent(keyParam);
      }
      rawUrl = ""; // Force resolving direct Cloudflare URL
    } catch {}
  }

  // If rawUrl is a relative path or storage key (not http/https), treat it as storageKey
  if (!storageKey && rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    storageKey = rawUrl;
    rawUrl = "";
  }

  const cleanBucket = getBucketName(bucket);
  const cleanKey = storageKey ? sanitizeStoragePath(storageKey, cleanBucket).replace(/^\/+/, "") : "";
  const finalMime = getNoteMimeType(fileName || cleanKey || rawUrl, mimeType, fileType);

  // If cleanKey is empty and rawUrl is already a direct external HTTPS URL to Cloudflare R2 or CDN (not pointing to /api/), return it directly
  if (!cleanKey && rawUrl && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) && !rawUrl.includes("/api/")) {
    return rawUrl;
  }

  if (!cleanKey) {
    throw new Error("Unable to open note: Missing file storage key.");
  }

  // 1. Check if direct public R2 URL/domain is configured
  const directPublicUrl = getR2PublicUrl(cleanBucket, cleanKey);
  if (directPublicUrl && !directPublicUrl.includes("/api/")) {
    return directPublicUrl;
  }

  // 2. Request a direct pre-signed URL from Cloudflare R2 with inline Content-Disposition
  const signedDetails = await getR2SignedUrlDetails({
    bucket: cleanBucket,
    key: cleanKey,
    expiresIn: 3600,
    operation: "getObject",
    contentType: finalMime,
  });

  if (signedDetails.signedUrl && !signedDetails.signedUrl.includes("/api/")) {
    return signedDetails.signedUrl;
  }

  // Fallback: If rawUrl is direct external HTTPS (not /api/), return it
  if (rawUrl && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) && !rawUrl.includes("/api/")) {
    return rawUrl;
  }

  throw new Error("Unable to open note: Direct storage URL could not be resolved.");
}

/**
 * Universal Note Opener for Desktop, Android, iPad, and installed PWAs.
 * Directly opens notes in the browser or OS-native viewer via window.open(url, "_blank", "noopener,noreferrer").
 * Never proxies note viewing through Vercel or serverless endpoints.
 */
export async function openNote(target: string | NoteOpeningTarget): Promise<void> {
  try {
    const directUrl = await resolveDirectNoteUrl(target);

    if (!directUrl || directUrl.includes("/api/")) {
      throw new Error("Invalid or serverless note URL blocked.");
    }

    console.log(`[openNote] Opening direct note URL on Cloudflare R2:`, directUrl);

    // Track study progress if student information is attached
    if (typeof target === "object" && target !== null && target.studentId) {
      try {
        const { recordNoteOpenedOrDownloaded } = await import("../utils/chapterProgressHelper");
        recordNoteOpenedOrDownloaded(
          target.studentId,
          target.subject,
          target.noteId || target.storageKey || target.storagePath || ""
        );
      } catch (trackErr) {
        console.warn("[openNote] Progress recording notice:", trackErr);
      }
    }

    // Direct browser / OS handoff: Allow operating system to launch its native PDF / Image viewer
    const win = window.open(directUrl, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === "undefined") {
      // Fallback for popup blocker in mobile PWA
      const a = document.createElement("a");
      a.href = directUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err: any) {
    console.error("[openNote] Note opening failed:", err);
    alert("Unable to open note.");
  }
}
