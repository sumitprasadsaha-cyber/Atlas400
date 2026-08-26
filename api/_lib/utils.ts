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
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
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
export async function streamToBuffer(stream: Readable | any): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream;
  if (!stream || typeof stream.on !== "function") return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export interface ParsedMultipartPart {
  name: string;
  filename?: string;
  contentType: string;
  data: Buffer;
}

export interface ParsedMultipartResult {
  fields: Record<string, string>;
  files: ParsedMultipartPart[];
}

/**
 * High-performance, zero-dependency multipart/form-data buffer parser.
 */
export function parseMultipartFormData(buffer: Buffer, boundary: string): ParsedMultipartResult {
  const result: ParsedMultipartResult = {
    fields: {},
    files: [],
  };

  if (!buffer || buffer.length === 0 || !boundary) {
    return result;
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const crlfcrlf = Buffer.from("\r\n\r\n");

  let start = buffer.indexOf(boundaryBuffer);
  while (start !== -1) {
    const nextStart = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (nextStart === -1) break;

    // Slice part data including headers and trailing CRLF
    const partBuffer = buffer.subarray(start + boundaryBuffer.length, nextStart);
    const headerEndIndex = partBuffer.indexOf(crlfcrlf);

    if (headerEndIndex !== -1) {
      const headerText = partBuffer.subarray(0, headerEndIndex).toString("utf-8");
      // Strip leading \r\n from headers if present
      const cleanHeaders = headerText.replace(/^\r\n/, "");
      
      // Data is after \r\n\r\n, and before the trailing \r\n
      let bodyData = partBuffer.subarray(headerEndIndex + crlfcrlf.length);
      if (bodyData.length >= 2 && bodyData[bodyData.length - 2] === 0x0d && bodyData[bodyData.length - 1] === 0x0a) {
        bodyData = bodyData.subarray(0, bodyData.length - 2);
      }

      // Parse headers
      const nameMatch = cleanHeaders.match(/name="([^"]+)"/i);
      const filenameMatch = cleanHeaders.match(/filename="([^"]+)"/i);
      const contentTypeMatch = cleanHeaders.match(/Content-Type:\s*([^\r\n;]+)/i);

      const fieldName = nameMatch ? nameMatch[1] : "";
      const filename = filenameMatch ? filenameMatch[1] : undefined;
      const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream";

      if (fieldName) {
        if (filename !== undefined) {
          result.files.push({
            name: fieldName,
            filename,
            contentType,
            data: bodyData,
          });
        } else {
          result.fields[fieldName] = bodyData.toString("utf-8");
        }
      }
    }

    start = nextStart;
  }

  return result;
}

export interface UploadPayload {
  buffer: Buffer;
  key: string;
  bucket: string;
  contentType: string;
  fileName?: string;
  size: number;
}

/**
 * Extracts normalized upload payload from diverse HTTP request structures
 * (multipart/form-data, raw binary buffer, base64 in JSON, or streaming requests).
 */
export async function extractUploadPayload(req: any): Promise<UploadPayload> {
  const reqContentType = (req.headers?.["content-type"] || req.headers?.["Content-Type"] || "").toLowerCase();
  
  let rawBuffer: Buffer = Buffer.alloc(0);
  if (Buffer.isBuffer(req.body)) {
    rawBuffer = req.body;
  } else if (req.body?.rawBuffer && Buffer.isBuffer(req.body.rawBuffer)) {
    rawBuffer = req.body.rawBuffer;
  } else if (typeof req.on === "function" && req.readable) {
    rawBuffer = await streamToBuffer(req);
  }

  let resolvedBuffer: Buffer = Buffer.alloc(0);
  let resolvedKey = (req.query?.key as string) || (req.body?.key as string) || "";
  let resolvedBucket = (req.query?.bucket as string) || (req.body?.bucket as string) || "";
  let resolvedContentType = (req.query?.mimeType as string) || (req.body?.mimeType as string) || "";
  let resolvedFileName = (req.query?.filename as string) || (req.body?.filename as string) || "";

  // 1. Handle multipart/form-data
  if (reqContentType.includes("multipart/form-data")) {
    const boundaryMatch = reqContentType.match(/boundary=([^;]+)/i);
    const boundary = boundaryMatch ? boundaryMatch[1].trim().replace(/^["']|["']$/g, "") : "";
    if (boundary && rawBuffer.length > 0) {
      const parsed = parseMultipartFormData(rawBuffer, boundary);
      if (parsed.files.length > 0) {
        const filePart = parsed.files.find((f) => f.name === "file" || f.name === "pdf") || parsed.files[0];
        resolvedBuffer = filePart.data;
        resolvedFileName = resolvedFileName || filePart.filename || "";
        resolvedContentType = resolvedContentType || filePart.contentType || getMimeType(resolvedFileName);
      }
      resolvedKey = resolvedKey || parsed.fields.key || parsed.fields.storagePath || parsed.fields.path || "";
      resolvedBucket = resolvedBucket || parsed.fields.bucket || "";
      resolvedContentType = resolvedContentType || parsed.fields.mimeType || "";
    }
  }

  // 2. Handle JSON with base64 payload
  if (resolvedBuffer.length === 0) {
    if (req.body && typeof req.body === "object" && req.body.base64) {
      resolvedBuffer = Buffer.from(req.body.base64, "base64");
      resolvedKey = resolvedKey || req.body.key || req.body.storagePath || "";
      resolvedBucket = resolvedBucket || req.body.bucket || "";
      resolvedContentType = resolvedContentType || req.body.mimeType || "";
    } else if (rawBuffer.length > 0 && reqContentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(rawBuffer.toString("utf-8"));
        if (parsed.base64) {
          resolvedBuffer = Buffer.from(parsed.base64, "base64");
          resolvedKey = resolvedKey || parsed.key || parsed.storagePath || "";
          resolvedBucket = resolvedBucket || parsed.bucket || "";
          resolvedContentType = resolvedContentType || parsed.mimeType || "";
        }
      } catch {}
    }
  }

  // 3. Handle raw binary buffer directly
  if (resolvedBuffer.length === 0 && rawBuffer.length > 0) {
    resolvedBuffer = rawBuffer;
  }

  // 4. Resolve MIME Type & Filename fallbacks
  if (!resolvedContentType || resolvedContentType === "application/octet-stream") {
    resolvedContentType = getMimeType(resolvedKey || resolvedFileName || "file.pdf");
  }

  return {
    buffer: resolvedBuffer,
    key: resolvedKey,
    bucket: resolvedBucket,
    contentType: resolvedContentType,
    fileName: resolvedFileName,
    size: resolvedBuffer.length,
  };
}
