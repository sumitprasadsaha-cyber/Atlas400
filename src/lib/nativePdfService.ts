import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";
import { Capacitor } from "@capacitor/core";
import { getBucketName, sanitizeStoragePath } from "./storageService";
import { getR2SignedUrl, getR2PublicUrl, downloadFromR2 } from "./r2Client";
import { dataUrlToBlob } from "../utils/pdfUtils";

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
  cachedPath?: string;
  isNative?: boolean;
  objectUrl?: string;
  blob?: Blob;
}

// In-flight download/open operations tracker to prevent duplicate parallel downloads
const inFlightOperations = new Map<string, Promise<OpenPdfResult>>();

// Web in-memory object URL cache
const webBlobCache = new Map<string, { blob: Blob; objectUrl: string }>();

// Debounce mutex to ensure native activity or file viewer is opened cleanly
let lastViewerLaunchTimestamp = 0;
let isLaunchingViewerMutex = false;

/**
 * Utility wrapper that enforces a strict timeout on any Promise.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
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

export function getFileExtension(rawPathOrUrl: string, isImg: boolean): string {
  const clean = (rawPathOrUrl || "").split("?")[0].split("#")[0];
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    const ext = match[1].toLowerCase();
    if (["pdf", "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) {
      return ext;
    }
  }
  return isImg ? "jpg" : "pdf";
}

export function getMimeType(fileNameOrUrl: string, mimeType?: string, isImg?: boolean): string {
  if (mimeType && mimeType.trim() && !mimeType.includes("octet-stream")) {
    return mimeType.trim();
  }
  const ext = getFileExtension(fileNameOrUrl, !!isImg);
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return isImg ? "image/jpeg" : "application/pdf";
}

/**
 * Generates a deterministic, filesystem-safe filename for caching a PDF or Image in Directory.Cache.
 */
export function getPdfCacheFileName(rawPathOrUrl: string, noteId?: string, isImg?: boolean, ext?: string): string {
  const identifier = `${noteId || "doc"}_${rawPathOrUrl || ""}`;
  const cleanSlug = identifier
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 40);

  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const safeHash = Math.abs(hash).toString(36);

  const extension = ext ? ext.replace(/^\./, "") : isImg ? "jpg" : "pdf";
  if (isImg) {
    return `img_cache_${cleanSlug}_${safeHash}.${extension}`;
  }
  return `pdf_cache_${cleanSlug}_${safeHash}.${extension}`;
}

/**
 * Converts a Blob into a Base64 string required by Filesystem.writeFile.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read downloaded file bytes."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
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
 * Checks and validates local cache in Directory.Cache.
 */
export async function checkAndValidateLocalCache(
  cacheFileName: string,
  expectedExt: string
): Promise<{ exists: boolean; uri?: string; size?: number }> {
  const isNative = isNativePlatform();
  if (!isNative) {
    const cached = webBlobCache.get(cacheFileName);
    if (cached && cached.objectUrl && cached.blob.size > 0) {
      return { exists: true, uri: cached.objectUrl, size: cached.blob.size };
    }
    return { exists: false };
  }

  try {
    const statResult = await withTimeout(
      Filesystem.stat({ path: cacheFileName, directory: Directory.Cache }),
      1500,
      "Cache check timed out"
    );

    const fileSize = (statResult as any)?.size ?? 0;
    const fileType = (statResult as any)?.type ?? "";
    const hasValidExt = cacheFileName.toLowerCase().endsWith(`.${expectedExt.toLowerCase()}`);

    if (statResult && fileSize > 0 && fileType === "file" && hasValidExt) {
      const uriResult = await withTimeout(
        Filesystem.getUri({ path: cacheFileName, directory: Directory.Cache }),
        1500,
        "Get URI timed out"
      );
      return { exists: true, uri: uriResult.uri, size: fileSize };
    }

    // Corrupted cache file detected -> delete it
    console.warn(`[NativePdfService] Corrupted cache detected for ${cacheFileName} (size: ${fileSize}), removing.`);
    await Filesystem.deleteFile({ path: cacheFileName, directory: Directory.Cache }).catch(() => {});
  } catch {
    // Cache miss or stat error
  }
  return { exists: false };
}

/**
 * Resolves note metadata and download/stream URLs directly using the saved storageKey as single source of truth.
 */
export function resolveNoteMetadataAndUrls(options: OpenPdfOptions): {
  noteId: string;
  fileName: string;
  bucket: string;
  storageKey: string;
  objectKey: string;
  rawPath: string;
  rawUrl: string;
  isImg: boolean;
  ext: string;
  contentType: string;
  isDataOrBlobUrl: boolean;
  primaryUrl: string;
  candidateUrls: string[];
} {
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

  const rawPath = storageKey;
  const rawUrl = (
    options.url ||
    options.publicUrl ||
    options.fileUrl ||
    options.downloadUrl ||
    ""
  ).trim();

  const bucket = getBucketName(options.bucket || "academy-connect-files");

  // Determine file name
  let fileName =
    options.fileName ||
    options.pdfFileName ||
    options.filename ||
    (storageKey ? storageKey.split("/").pop() : "") ||
    (rawUrl && !rawUrl.startsWith("data:") && !rawUrl.startsWith("blob:") ? rawUrl.split("/").pop() : "") ||
    "document.pdf";

  // Sanitize object key (ensuring no leading slash, but preserving exact folder names)
  let objectKey = "";
  if (storageKey) {
    objectKey = sanitizeStoragePath(storageKey, bucket);
  }
  if (!objectKey && rawUrl && !rawUrl.startsWith("data:") && !rawUrl.startsWith("blob:")) {
    objectKey = sanitizeStoragePath(rawUrl, bucket);
  }
  if (objectKey.startsWith("/")) {
    objectKey = objectKey.replace(/^\/+/, "");
  }

  const isImg = isImageFile(fileName, rawUrl || objectKey, options.mimeType || options.mime_type, options.fileType);
  const ext = getFileExtension(fileName || objectKey || rawUrl, isImg);
  const contentType = getMimeType(fileName || objectKey || rawUrl, options.mimeType || options.mime_type, isImg);

  const isDataOrBlobUrl = Boolean(
    rawUrl && (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:") || rawUrl.startsWith("JVBERi"))
  );

  const candidateUrls: string[] = [];

  if (isDataOrBlobUrl) {
    candidateUrls.push(rawUrl);
  } else {
    // 1. Primary same-origin R2 download streaming proxy URL
    if (objectKey) {
      const baseUrl = typeof window !== "undefined" && window.location?.origin ? "" : "http://localhost:3000";
      const proxyUrl = `${baseUrl}/api/r2/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(objectKey)}`;
      candidateUrls.push(proxyUrl);

      // 2. Direct Public R2 URL (if custom domain configured)
      const publicUrl = getR2PublicUrl(bucket, objectKey);
      if (publicUrl && !candidateUrls.includes(publicUrl)) {
        candidateUrls.push(publicUrl);
      }
    }

    // 3. Raw URL if it is a full absolute URL
    if (rawUrl && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) && !candidateUrls.includes(rawUrl)) {
      candidateUrls.push(rawUrl);
    }
  }

  const primaryUrl = candidateUrls[0] || rawUrl || (objectKey ? `/api/r2/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(objectKey)}` : "");

  return {
    noteId,
    fileName,
    bucket,
    storageKey: objectKey || storageKey,
    objectKey: objectKey || storageKey,
    rawPath,
    rawUrl,
    isImg,
    ext,
    contentType,
    isDataOrBlobUrl,
    primaryUrl,
    candidateUrls,
  };
}

/**
 * Launch native file viewer intent exactly once with debounce protection.
 */
async function launchNativeViewerOnce(uri: string, contentType: string): Promise<void> {
  const now = Date.now();
  if (isLaunchingViewerMutex || now - lastViewerLaunchTimestamp < 2500) {
    return;
  }
  isLaunchingViewerMutex = true;
  lastViewerLaunchTimestamp = now;

  try {
    console.log(`[NativePdfService] Launching FileOpener on URI: ${uri}, Content-Type: ${contentType}`);
    await FileOpener.open({
      filePath: uri,
      contentType: contentType || "application/pdf",
    });
  } finally {
    setTimeout(() => {
      isLaunchingViewerMutex = false;
    }, 1500);
  }
}

/**
 * Main Note Opening Pipeline: Opens a Note PDF or Image using the device's native viewer.
 */
export async function openPdfWithNativeViewer(options: OpenPdfOptions): Promise<OpenPdfResult> {
  const meta = resolveNoteMetadataAndUrls(options);

  // Backward compatibility: If old notes don't contain storageKey or valid path
  if (!meta.objectKey && !meta.isDataOrBlobUrl) {
    const legacyMsg = "Legacy note detected.\nMissing storage key.\nPlease re-upload this note.";
    console.warn(`[NotePipeline] ${legacyMsg}`, options);
    alert(legacyMsg);
    throw new Error(legacyMsg);
  }

  // Required Debug Logs before requesting R2
  console.log("Saved Storage Key:", meta.storageKey);
  console.log("Bucket:", meta.bucket);
  console.log("Opening:", meta.primaryUrl);

  const updateProgress = (percent: number | null, text: string) => {
    if (options.onProgress) options.onProgress(percent, text);
  };

  const cacheFileName = getPdfCacheFileName(meta.objectKey || meta.rawPath || meta.rawUrl, meta.noteId, meta.isImg, meta.ext);

  // In-flight deduplication: return existing promise if already running
  if (inFlightOperations.has(cacheFileName)) {
    console.log(`[NotePipeline] Reusing in-flight operation for ${cacheFileName}`);
    return inFlightOperations.get(cacheFileName)!;
  }

  const executeOperation = async (): Promise<OpenPdfResult> => {
    const isNative = isNativePlatform();

    // Step 1: Check Local Cache
    updateProgress(null, "Preparing Note…");
    const cacheCheck = await checkAndValidateLocalCache(cacheFileName, meta.ext);

    if (cacheCheck.exists && cacheCheck.uri) {
      console.log("[NotePipeline] CACHE_HIT - opening directly from local cache:", {
        noteId: meta.noteId,
        cacheFileName,
        uri: cacheCheck.uri,
        size: cacheCheck.size,
      });

      updateProgress(100, "Opening…");

      if (isNative) {
        try {
          await launchNativeViewerOnce(cacheCheck.uri, meta.contentType);
          return { success: true, cachedPath: cacheCheck.uri, isNative: true };
        } catch (openerErr: any) {
          console.warn("[NotePipeline] Opener failed on cached file, removing cache and refetching:", openerErr);
          await Filesystem.deleteFile({ path: cacheFileName, directory: Directory.Cache }).catch(() => {});
        }
      } else {
        const cached = webBlobCache.get(cacheFileName);
        const objUrl = cacheCheck.uri || (cached?.blob ? URL.createObjectURL(cached.blob) : meta.primaryUrl);
        openUrlInBrowserNativeTab(objUrl);
        return {
          success: true,
          isNative: false,
          cachedPath: cacheCheck.uri,
          objectUrl: objUrl,
          blob: cached?.blob,
        };
      }
    }

    // Step 2: Handle Web Platform
    if (!isNative) {
      updateProgress(null, "Connecting…");

      // For data / blob URLs, open immediately
      if (meta.isDataOrBlobUrl) {
        openUrlInBrowserNativeTab(meta.primaryUrl);
        return { success: true, isNative: false, objectUrl: meta.primaryUrl };
      }

      if (!meta.primaryUrl) {
        throw new Error(
          `Unable to open note "${meta.fileName}": No valid storage path or URL found for note ID "${meta.noteId}".`
        );
      }

      // Verify the generated URL via HTTP probe before opening
      try {
        let headRes = await fetch(meta.primaryUrl, { method: "HEAD" }).catch(() => null);
        if (!headRes || headRes.status === 405) {
          // If HEAD is not supported, probe with GET
          headRes = await fetch(meta.primaryUrl, { method: "GET" }).catch(() => null);
        }

        if (headRes) {
          if (headRes.status === 404) {
            let errorBody = "";
            try {
              const clone = headRes.clone();
              errorBody = await clone.text();
            } catch {}

            // Debug logs required if R2 returns 404
            console.error("Saved storage key:", meta.storageKey);
            console.error("Requested URL:", meta.primaryUrl);
            console.error("Bucket:", meta.bucket);
            console.error("HTTP Status:", headRes.status);
            console.error("Response body:", errorBody);

            throw new Error(
              `Note file not found in Cloudflare R2 (HTTP 404).\nSaved Storage Key: "${meta.storageKey}"\nBucket: "${meta.bucket}"`
            );
          }

          if (headRes.status === 403) {
            throw new Error(
              `Access denied to note (HTTP 403).\nStorage Key: "${meta.storageKey}"\nBucket: "${meta.bucket}"`
            );
          }

          if (!headRes.ok) {
            throw new Error(
              `Failed to load note (HTTP ${headRes.status}: ${headRes.statusText}).\nURL: ${meta.primaryUrl}`
            );
          }
        }
      } catch (probeErr: any) {
        // If it's our explicit HTTP 404 / 403 / status error, rethrow it
        if (probeErr.message && (probeErr.message.includes("HTTP 404") || probeErr.message.includes("HTTP 403") || probeErr.message.includes("HTTP "))) {
          throw probeErr;
        }
        console.warn("[NotePipeline] URL probe warning (proceeding with direct open):", probeErr);
      }

      updateProgress(100, "Opening…");
      openUrlInBrowserNativeTab(meta.primaryUrl);
      return { success: true, isNative: false, objectUrl: meta.primaryUrl };
    }

    // Step 3: Handle Native Mobile Platform (Android / iOS Capacitor)
    console.log("[NotePipeline] Mobile Platform: Downloading note for native FileOpener:", {
      noteId: meta.noteId,
      bucket: meta.bucket,
      storageKey: meta.storageKey,
      cacheFileName,
    });

    updateProgress(null, "Connecting…");

    let downloadedBlob: Blob | null = null;

    if (meta.isDataOrBlobUrl) {
      downloadedBlob = await dataUrlToBlob(meta.rawUrl);
    } else {
      let downloadError: Error | null = null;

      for (const targetUrl of meta.candidateUrls) {
        try {
          console.log(`[NotePipeline] Mobile download attempting URL: ${targetUrl}`);
          const res = await fetch(targetUrl);

          if (res.status === 404) {
            let errorBody = "";
            try {
              const clone = res.clone();
              errorBody = await clone.text();
            } catch {}

            console.error("Saved storage key:", meta.storageKey);
            console.error("Requested URL:", targetUrl);
            console.error("Bucket:", meta.bucket);
            console.error("HTTP Status:", res.status);
            console.error("Response body:", errorBody);

            throw new Error(`Note file not found in storage (HTTP 404). Key: "${meta.storageKey}" in bucket "${meta.bucket}"`);
          }

          if (res.status === 403) {
            throw new Error(`Access forbidden (HTTP 403) for note key: "${meta.storageKey}" in bucket "${meta.bucket}"`);
          }

          if (!res.ok) {
            throw new Error(`Storage server returned HTTP ${res.status}: ${res.statusText}`);
          }

          downloadedBlob = await res.blob();
          if (downloadedBlob && downloadedBlob.size > 0) {
            break;
          }
        } catch (fetchErr: any) {
          downloadError = fetchErr;
          console.warn(`[NotePipeline] Download attempt failed for ${targetUrl}:`, fetchErr?.message || fetchErr);
        }
      }

      if (!downloadedBlob || downloadedBlob.size === 0) {
        // Fallback: try downloadFromR2 helper
        try {
          console.log(`[NotePipeline] Attempting downloadFromR2 fallback for key="${meta.storageKey}"`);
          const r2Res = await downloadFromR2({ bucket: meta.bucket, key: meta.storageKey });
          if (r2Res.blob && r2Res.blob.size > 0) {
            downloadedBlob = r2Res.blob;
          }
        } catch (r2Err: any) {
          console.warn("[NotePipeline] downloadFromR2 fallback failed:", r2Err);
        }
      }

      if (!downloadedBlob || downloadedBlob.size === 0) {
        throw downloadError || new Error(`Failed to download note file "${meta.fileName}" from storage.`);
      }
    }

    // Save downloaded blob to local cache
    updateProgress(90, "Saving to Cache…");
    const base64Data = await blobToBase64(downloadedBlob);

    await Filesystem.writeFile({
      path: cacheFileName,
      directory: Directory.Cache,
      data: base64Data,
      recursive: true,
    });

    const uriResult = await Filesystem.getUri({
      path: cacheFileName,
      directory: Directory.Cache,
    });

    console.log(`[NotePipeline] File saved to cache: uri="${uriResult.uri}", size=${downloadedBlob.size} bytes`);

    updateProgress(100, "Opening…");
    await launchNativeViewerOnce(uriResult.uri, meta.contentType);

    return {
      success: true,
      isNative: true,
      cachedPath: uriResult.uri,
      blob: downloadedBlob,
    };
  };

  const operationPromise = executeOperation().finally(() => {
    inFlightOperations.delete(cacheFileName);
  });

  inFlightOperations.set(cacheFileName, operationPromise);
  return operationPromise;
}

/**
 * Opens a URL in the browser's native viewer/tab cleanly.
 */
function openUrlInBrowserNativeTab(url: string): void {
  try {
    const newWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      // Fallback if popup blocker intercepted window.open
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (openErr) {
    console.warn("[NotePipeline] Direct window.open failed, trying link fallback:", openErr);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Top-level function for Admin and Student consoles to open any Note in the device's native viewer.
 * No custom or embedded viewers are rendered.
 */
export async function openNoteInNativeViewer(
  options: OpenPdfOptions & { studentId?: string; subject?: string }
): Promise<OpenPdfResult> {
  const meta = resolveNoteMetadataAndUrls(options);

  try {
    const result = await openPdfWithNativeViewer(options);

    // If student opened, record analytics and study progress
    if (options.studentId && (meta.noteId || meta.storageKey)) {
      try {
        const { recordNoteOpenedOrDownloaded } = await import("../utils/chapterProgressHelper");
        recordNoteOpenedOrDownloaded(options.studentId, options.subject, meta.noteId || meta.storageKey);
      } catch (recErr) {
        console.warn("[NativeNoteOpener] Error recording study progress:", recErr);
      }
    }

    return result;
  } catch (err: any) {
    const errorMsg = err?.message || "Failed to open note due to an unexpected error.";
    console.error(`[NativeNoteOpener] Failed to open note "${meta.noteId}" in native viewer:`, {
      noteId: meta.noteId,
      title: options.title,
      fileName: meta.fileName,
      storageKey: meta.storageKey,
      bucket: meta.bucket,
      mimeType: meta.contentType,
      primaryUrl: meta.primaryUrl,
      error: err,
      stack: err?.stack,
    });
    alert(errorMsg);
    throw err;
  }
}

/**
 * Saves and opens a client-side generated PDF blob on native Android or web.
 */
export async function saveAndOpenGeneratedPdf(pdfBlob: Blob, fileName: string): Promise<void> {
  const cleanFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  const isNative = isNativePlatform();

  console.log(`[NativePdfService] saveAndOpenGeneratedPdf: fileName="${cleanFileName}", isNative=${isNative}, size=${pdfBlob.size} bytes`);

  if (!isNative) {
    const objectUrl = URL.createObjectURL(pdfBlob);
    openUrlInBrowserNativeTab(objectUrl);
    return;
  }

  try {
    const base64Data = await blobToBase64(pdfBlob);
    await Filesystem.writeFile({
      path: cleanFileName,
      directory: Directory.Cache,
      data: base64Data,
      recursive: true,
    });

    const uriResult = await Filesystem.getUri({
      path: cleanFileName,
      directory: Directory.Cache,
    });

    await launchNativeViewerOnce(uriResult.uri, "application/pdf");
  } catch (err: any) {
    console.error("[NativePdfService] Failed saving/opening generated PDF:", err);
    throw new Error(`Failed to open generated document: ${err.message || err}`);
  }
}

/**
 * Invalidates local cache for a specific note if updated or replaced.
 */
export async function invalidateNoteCache(rawPathOrUrl: string, noteId?: string, isImg?: boolean): Promise<void> {
  const cacheFileName = getPdfCacheFileName(rawPathOrUrl, noteId, isImg);
  webBlobCache.delete(cacheFileName);

  if (isNativePlatform()) {
    try {
      await Filesystem.deleteFile({
        path: cacheFileName,
        directory: Directory.Cache,
      });
      console.log(`[NativePdfService] Cache invalidated for ${cacheFileName}`);
    } catch {
      // Ignored if file did not exist
    }
  }
}
