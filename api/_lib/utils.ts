import path from "path";
import { Readable } from "stream";

/**
 * Normalizes and sanitizes storage key paths, removing leading slashes and path traversals.
 */
export function sanitizeKey(key: string, bucketName?: string): string {
  if (!key) return "";
  let clean = String(key).trim().replace(/\\/g, "/");

  // Remove full URLs if accidentally passed
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const parsed = new URL(clean);
      clean = parsed.pathname;
    } catch {
      // ignore
    }
  }

  // Remove leading bucket name if prefixed
  if (bucketName) {
    const bucketPrefix = `${bucketName}/`;
    if (clean.startsWith(bucketPrefix)) {
      clean = clean.substring(bucketPrefix.length);
    }
  }

  // Remove leading slashes and collapse duplicate slashes
  clean = clean.replace(/^\/+/, "").replace(/\/{2,}/g, "/");

  // Prevent path traversal
  clean = clean.replace(/\.\./g, "_");

  return clean;
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
