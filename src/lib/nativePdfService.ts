import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { getBucketName, sanitizeStoragePath } from "./storageService";
import { getR2SignedUrl, getR2PublicUrl } from "./r2Client";

export type NoteViewerState = "idle" | "downloading" | "opening" | "opened" | "error";

export interface OpenPdfOptions {
  storageKey?: string;
  storage_key?: string;
  storagePath?: string;
  storage_path?: string;
  objectKey?: string;
  r2Key?: string;
  key?: string;
  url?: string;
  publicUrl?: string;
  fileUrl?: string;
  downloadUrl?: string;
  bucket?: string;
  noteId?: string;
  fileName?: string;
  pdfFileName?: string;
  filename?: string;
  mimeType?: string;
  mime_type?: string;
  fileType?: "pdf" | "image" | string;
  title?: string;
  storageProvider?: string;
  studentId?: string;
  subject?: string;
  onProgress?: (percent: number | null, statusText: string) => void;
}

export interface OpenPdfResult {
  success: boolean;
  message?: string;
  signedUrl?: string;
  isNative?: boolean;
  blob?: any;
  objectUrl?: string;
}

/**
 * Checks if running in a native Capacitor mobile environment (Android or iOS).
 */
export function isNativePlatform(): boolean {
  if (typeof Capacitor !== "undefined") {
    if (typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform()) {
      return true;
    }
    const platform = typeof Capacitor.getPlatform === "function" ? Capacitor.getPlatform() : "";
    if (platform === "android" || platform === "ios") {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether a given note or file is an image based on fileType, mimeType, or filename extension.
 */
export function isImageFile(fileName?: string, url?: string, mimeType?: string, fileType?: string): boolean {
  if (fileType === "image") return true;
  if (mimeType && mimeType.toLowerCase().startsWith("image/")) return true;
  const str = (fileName || url || "").toLowerCase();
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?.*)?$/i.test(str);
}

/**
 * Resolves standard MIME type based on file extension or provided MIME type.
 */
export function getMimeType(fileNameOrUrl: string, mimeType?: string, isImg?: boolean): string {
  if (mimeType && mimeType.trim() && !mimeType.includes("octet-stream")) {
    return mimeType.trim();
  }
  const clean = (fileNameOrUrl || "").split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".pdf")) return "application/pdf";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return isImg ? "image/jpeg" : "application/pdf";
}

/**
 * Directly hands off a signed URL to the device's native browser / viewer.
 * No custom or in-app note rendering is performed.
 */
async function handoffUrlToNativeBrowser(url: string): Promise<void> {
  const isNative = isNativePlatform();

  if (isNative) {
    try {
      await Browser.open({ url, windowName: "_blank" });
      return;
    } catch (browserErr) {
      console.warn("[NotePipeline] Capacitor Browser.open fallback:", browserErr);
    }
  }

  // Web / PWA / Browser standard handoff
  try {
    const newWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      // If popup blocker intervened, fallback to link click or navigation
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (windowErr) {
    console.warn("[NotePipeline] window.open failed, navigating via window.location.assign:", windowErr);
    window.location.assign(url);
  }
}

/**
 * Main Note Opening Service:
 * Generates a signed Cloudflare R2 URL using the exact stored storageKey
 * and immediately hands it off to the device's native browser or native viewer.
 * 
 * Absolutely no in-memory blob fetching, base64 conversions, or in-app custom rendering.
 */
export async function openPdfWithNativeViewer(options: OpenPdfOptions): Promise<OpenPdfResult> {
  const noteId = options.noteId || "unknown";

  // Single source of truth: extract the exact saved storageKey
  const storageKey = (
    options.storageKey ||
    options.storage_key ||
    options.storagePath ||
    options.storage_path ||
    options.objectKey ||
    options.r2Key ||
    options.key ||
    ""
  ).trim();

  const rawUrl = (
    options.url ||
    options.publicUrl ||
    options.fileUrl ||
    options.downloadUrl ||
    ""
  ).trim();

  const bucket = getBucketName(options.bucket || "academy-connect-files");

  // Determine file name and MIME type
  const fileName =
    options.fileName ||
    options.pdfFileName ||
    options.filename ||
    (storageKey ? storageKey.split("/").pop() : "") ||
    "document.pdf";

  const isImg = isImageFile(fileName, rawUrl || storageKey, options.mimeType || options.mime_type, options.fileType);
  const mimeType = getMimeType(fileName || storageKey || rawUrl, options.mimeType || options.mime_type, isImg);

  // Backward compatibility check
  if (!storageKey && !rawUrl) {
    console.warn("[NotePipeline] Legacy note detected with missing storage key:", options);
    alert("Legacy note detected.\nMissing storage key.\nPlease re-upload this note.");
    throw new Error("Legacy note detected. Missing storage key. Please re-upload this note.");
  }

  // Handle direct data URL or full external URL if present
  if (rawUrl && (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:"))) {
    await handoffUrlToNativeBrowser(rawUrl);
    return { success: true, signedUrl: rawUrl, isNative: isNativePlatform() };
  }

  // Generate signed Cloudflare R2 URL using exact stored storageKey
  const exactKey = storageKey ? sanitizeStoragePath(storageKey, bucket).replace(/^\/+/, "") : "";
  let signedUrl = "";

  try {
    if (exactKey) {
      signedUrl = await getR2SignedUrl({
        bucket,
        key: exactKey,
        expiresIn: 3600,
        operation: "getObject",
        contentType: mimeType,
      });
    } else if (rawUrl) {
      signedUrl = rawUrl;
    }
  } catch (err: any) {
    console.error("[NotePipeline] Failed generating signed URL:", err);
    alert("Unable to generate secure access to this note.");
    throw new Error("Unable to generate secure access to this note.");
  }

  if (!signedUrl) {
    alert("Unable to generate secure access to this note.");
    throw new Error("Unable to generate secure access to this note.");
  }

  // Ensure absolute URL if running inside web or mobile app
  let absoluteUrl = signedUrl;
  if (signedUrl.startsWith("/")) {
    const origin =
      typeof window !== "undefined" &&
      window.location &&
      window.location.origin &&
      !window.location.origin.includes("capacitor://")
        ? window.location.origin
        : "http://localhost:3000";
    absoluteUrl = `${origin}${signedUrl}`;
  }

  // Append mimeType hint to proxy download URL if present so the backend streams with exact Content-Type
  if (absoluteUrl.includes("/api/r2/download") && !absoluteUrl.includes("mimeType=") && mimeType) {
    const sep = absoluteUrl.includes("?") ? "&" : "?";
    absoluteUrl = `${absoluteUrl}${sep}mimeType=${encodeURIComponent(mimeType)}`;
  }

  // Required Debug Logs for note retrieval
  console.log("=== [NOTE RETRIEVAL PIPELINE] ===");
  console.log("Firestore storageKey:", exactKey || storageKey);
  console.log("Bucket name:", bucket);
  console.log("Signed URL generated:", absoluteUrl);

  // Fast pre-flight verification for 404 / 403 errors (without loading file into memory)
  try {
    let probeRes = await fetch(absoluteUrl, { method: "HEAD" }).catch(() => null);
    if (!probeRes || probeRes.status === 405) {
      probeRes = await fetch(absoluteUrl, { method: "GET" }).catch(() => null);
    }

    if (probeRes) {
      console.log("HTTP status from R2:", probeRes.status);
      console.log("================================");

      if (probeRes.status === 404) {
        let responseBody = "";
        try {
          const clone = probeRes.clone();
          responseBody = await clone.text();
        } catch {}

        // Required Debug logs if object cannot be found
        console.error("=== [R2 OBJECT NOT FOUND] ===");
        console.error("Requested key:", storageKey || exactKey);
        console.error("Bucket:", bucket);
        console.error("Exact key sent to R2:", exactKey);
        console.error("Firestore document ID:", noteId);
        console.error("HTTP status from R2:", 404);
        console.error("Response body:", responseBody);
        console.error("=============================");

        alert("This note file could not be found in Cloudflare Storage.\nPlease contact the administrator.");
        throw new Error("This note file could not be found in Cloudflare Storage. Please contact the administrator.");
      }

      if (probeRes.status === 403) {
        alert("Unable to generate secure access to this note.");
        throw new Error("Unable to generate secure access to this note.");
      }
    } else {
      console.log("HTTP status from R2: 200 (Direct)");
      console.log("================================");
    }
  } catch (probeErr: any) {
    if (
      probeErr.message &&
      (probeErr.message.includes("could not be found") || probeErr.message.includes("secure access"))
    ) {
      throw probeErr;
    }
    console.warn("[NotePipeline] Pre-flight probe warning (proceeding with native open):", probeErr);
  }

  // Immediately hand off to device native browser or native viewer
  await handoffUrlToNativeBrowser(absoluteUrl);

  return {
    success: true,
    signedUrl: absoluteUrl,
    isNative: isNativePlatform(),
  };
}

/**
 * Top-level unified function for Admin Console and Student Console.
 * Directly launches device native browser/viewer and records study progress if student is active.
 */
export async function openNoteInNativeViewer(
  options: OpenPdfOptions & { studentId?: string; subject?: string }
): Promise<OpenPdfResult> {
  const result = await openPdfWithNativeViewer(options);

  // If student opened, record study progress
  if (options.studentId && (options.noteId || options.storageKey || options.storagePath)) {
    try {
      const { recordNoteOpenedOrDownloaded } = await import("../utils/chapterProgressHelper");
      recordNoteOpenedOrDownloaded(
        options.studentId,
        options.subject,
        options.noteId || options.storageKey || options.storagePath || ""
      );
    } catch (recErr) {
      console.warn("[NativeNoteOpener] Error recording study progress:", recErr);
    }
  }

  return result;
}

/**
 * Saves and opens a client-side generated PDF blob on native browser.
 */
export async function saveAndOpenGeneratedPdf(pdfBlob: Blob, fileName: string): Promise<void> {
  const objectUrl = URL.createObjectURL(pdfBlob);
  await handoffUrlToNativeBrowser(objectUrl);
}

/**
 * Invalidates cache helper.
 */
export async function invalidateNoteCache(rawPathOrUrl: string, noteId?: string, isImg?: boolean): Promise<void> {
  // No-op as in-app cache is removed in favor of direct signed URL native browser streaming
}
