import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { openNote, resolveDirectNoteUrl, getNoteMimeType, NoteOpeningTarget } from "./noteOpener";

export { openNote, resolveDirectNoteUrl, getNoteMimeType };

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
 * Detects current runtime platform and browser details for diagnostic logging.
 */
export function getRuntimePlatformDetails() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /android/i.test(ua);
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
  const isDesktop = !isAndroid && !isIOS;
  const isPWA =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes("android-app://"));
  const isNative = isNativePlatform();

  let browser = "Unknown";
  if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";

  return {
    platform: isNative ? "Capacitor Native" : isPWA ? "PWA Standalone" : "Web Browser",
    browser,
    userAgent: ua,
    isAndroid,
    isIOS,
    isDesktop,
    isPWA,
    isNative,
  };
}

/**
 * Determines whether a given note or file is an image based on fileType, mimeType, or filename extension.
 */
export function isImageFile(fileName?: string, url?: string, mimeType?: string, fileType?: string): boolean {
  if (fileType === "image") return true;
  if (mimeType && mimeType.toLowerCase().startsWith("image/")) return true;
  const str = (fileName || url || "").toLowerCase();
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg|heic|heif)(\?.*)?$/i.test(str);
}

/**
 * Resolves standard MIME type based on file extension or provided MIME type.
 */
export function getMimeType(fileNameOrUrl: string, mimeType?: string, isImg?: boolean): string {
  return getNoteMimeType(fileNameOrUrl, mimeType, isImg ? "image" : undefined);
}

/**
 * Directly opens a note using device-native browser or viewer.
 * Absolutely no proxying through Vercel or serverless endpoints.
 */
export async function openPdfWithNativeViewer(options: OpenPdfOptions): Promise<OpenPdfResult> {
  try {
    const directUrl = await resolveDirectNoteUrl(options);
    if (!directUrl || directUrl.includes("/api/")) {
      throw new Error("Unable to resolve direct note storage URL.");
    }

    const platformDetails = getRuntimePlatformDetails();
    console.log("=== [FRONTEND DIRECT NOTE OPEN AUDIT] ===");
    console.log("platform:", platformDetails.platform);
    console.log("browser:", platformDetails.browser);
    console.log("directUrl:", directUrl);
    console.log("=========================================");

    await openNote(options);

    return {
      success: true,
      signedUrl: directUrl,
      isNative: isNativePlatform(),
    };
  } catch (err: any) {
    console.error("[nativePdfService] Failed opening note:", err);
    throw err;
  }
}

/**
 * Top-level unified function for Admin Console and Student Console.
 * Directly launches device native browser/viewer and records study progress if student is active.
 */
export async function openNoteInNativeViewer(
  options: OpenPdfOptions & { studentId?: string; subject?: string }
): Promise<OpenPdfResult> {
  return await openPdfWithNativeViewer(options);
}

/**
 * Saves and opens a client-side generated PDF blob on native browser.
 */
export async function saveAndOpenGeneratedPdf(pdfBlob: Blob, fileName: string): Promise<void> {
  const objectUrl = URL.createObjectURL(pdfBlob);
  const win = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!win || win.closed || typeof win.closed === "undefined") {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Invalidates cache helper.
 */
export async function invalidateNoteCache(rawPathOrUrl: string, noteId?: string, isImg?: boolean): Promise<void> {
  // Direct R2 streaming is stateless and requires no in-app blob cache invalidation
}
