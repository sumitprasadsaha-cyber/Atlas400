import path from "path";
import { Readable } from "stream";

/**
 * Normalizes and sanitizes storage key paths, extracting keys from URLs or query strings,
 * removing leading slashes, decoding URI components, and preventing path traversals.
 */
export function sanitizeKey(key: string, bucketName?: string): string {
  if (!key) return "";
  let clean = String(key).trim();

  // 0. Handle JSON metadata strings
  if (clean.startsWith("{")) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.storagePath) {
        clean = String(parsed.storagePath).trim();
      } else if (parsed.key) {
        clean = String(parsed.key).trim();
      } else if (parsed.storageKey) {
        clean = String(parsed.storageKey).trim();
      } else if (parsed.downloadUrl) {
        clean = String(parsed.downloadUrl).trim();
      } else if (parsed.url) {
        clean = String(parsed.url).trim();
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // 1. Extract from key/storageKey/storagePath query params in URLs or relative paths
  if (clean.includes("key=") || clean.includes("storageKey=") || clean.includes("storagePath=")) {
    try {
      const fakeBase = "http://localhost";
      const urlObj = new URL(clean.startsWith("http") ? clean : `${fakeBase}${clean.startsWith("/") ? "" : "/"}${clean}`);
      const keyParam = urlObj.searchParams.get("key") || urlObj.searchParams.get("storageKey") || urlObj.searchParams.get("storagePath");
      if (keyParam) {
        clean = decodeURIComponent(keyParam);
      }
    } catch {
      const match = clean.match(/[?&](?:key|storageKey|storagePath)=([^&]+)/);
      if (match && match[1]) {
        clean = decodeURIComponent(match[1]);
      }
    }
  }

  // 2. Normalize slashes & remove quotes
  clean = clean.replace(/\\/g, "/");
  clean = clean.replace(/^["']|["']$/g, "");

  // 3. Handle gs:// or s3:// protocol URLs
  if (clean.startsWith("gs://") || clean.startsWith("s3://")) {
    const withoutPrefix = clean.substring(5);
    const slashIdx = withoutPrefix.indexOf("/");
    if (slashIdx !== -1) {
      clean = withoutPrefix.substring(slashIdx + 1);
    } else {
      clean = "";
    }
  }

  // 4. Handle full HTTP/HTTPS URLs (R2 public domain or proxy URL)
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const urlObj = new URL(clean);
      const pathname = urlObj.pathname;
      const keyParam = urlObj.searchParams.get("key") || urlObj.searchParams.get("storageKey");
      if (keyParam) {
        clean = decodeURIComponent(keyParam);
      } else {
        const segments = pathname.replace(/^\/+/, "").split("/");
        if (bucketName && segments[0] === bucketName) {
          segments.shift();
        }
        clean = segments.join("/");
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  // 5. Decode URI encoding safely
  if (clean.includes("%")) {
    try {
      let decoded = decodeURIComponent(clean);
      if (decoded.includes("%")) {
        decoded = decodeURIComponent(decoded);
      }
      clean = decoded;
    } catch {
      // ignore
    }
  }

  // 6. Strip query parameters and hash fragments if any remain
  if (clean.includes("?")) {
    clean = clean.split("?")[0];
  }
  if (clean.includes("#")) {
    clean = clean.split("#")[0];
  }

  // 7. Remove leading bucket name if prefixed
  if (bucketName) {
    const bucketPrefix = `${bucketName}/`;
    if (clean.startsWith(bucketPrefix)) {
      clean = clean.substring(bucketPrefix.length);
    }
  }
  if (clean.startsWith("academy-connect-files/")) {
    clean = clean.substring("academy-connect-files/".length);
  }

  // 8. Remove leading slashes and collapse duplicate slashes
  clean = clean.replace(/^\/+/, "").replace(/\/{2,}/g, "/");

  // 9. Prevent path traversal
  clean = clean.replace(/\.\./g, "_");

  // 10. Clean individual path segments
  const segments = clean
    .split("/")
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0 && seg !== "." && seg !== "..");

  return segments.join("/");
}

/**
 * Returns standard MIME type based on file extension.
 */
export function getMimeType(keyOrFilename: string, fallback: string = "application/octet-stream"): string {
  const lower = (keyOrFilename || "").toLowerCase().split("?")[0].split("#")[0];
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return fallback;
}

/**
 * Safely parses request body from buffer, string, or already parsed object.
 */
export function parseRequestBody<T = any>(body: any): T {
  if (!body) return {} as T;

  if (Buffer.isBuffer(body)) {
    try {
      const str = body.toString("utf-8");
      return JSON.parse(str);
    } catch {
      return { rawBuffer: body } as unknown as T;
    }
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return { rawString: body } as unknown as T;
    }
  }

  return body as T;
}

/**
 * Converts Readable stream or Buffer into a Buffer.
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
