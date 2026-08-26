import { uploadObjectToR2, getR2ServerConfig } from "../_lib/r2Server";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/octet-stream",
]);

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const config = getR2ServerConfig();
    const bucket = ((req.query?.bucket as string) || req.body?.bucket || config.bucket || "academy-connect-files").trim();
    
    let originalFilename = (req.query?.fileName as string) || req.body?.fileName || req.body?.originalFilename || "document.pdf";
    let mimeType = (req.query?.mimeType as string) || req.body?.mimeType || req.headers?.["content-type"] || "application/octet-stream";
    
    if (mimeType.includes(";")) {
      mimeType = mimeType.split(";")[0].trim();
    }

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body && typeof req.body === "object" && req.body.base64) {
      buffer = Buffer.from(req.body.base64, "base64");
      if (req.body.fileName) originalFilename = req.body.fileName;
      if (req.body.mimeType) mimeType = req.body.mimeType;
    } else if (typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        if (parsed.base64) {
          buffer = Buffer.from(parsed.base64, "base64");
          if (parsed.fileName) originalFilename = parsed.fileName;
          if (parsed.mimeType) mimeType = parsed.mimeType;
        } else {
          buffer = Buffer.from(req.body, "utf-8");
        }
      } catch {
        buffer = Buffer.from(req.body, "utf-8");
      }
    } else {
      return res.status(400).json({ error: "No upload body data received." });
    }

    // Size validation
    if (buffer.length === 0) {
      return res.status(400).json({ error: "File cannot be empty." });
    }
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: `File size exceeds 50MB limit (${Math.round(buffer.length / (1024 * 1024))}MB).` });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase()) && !mimeType.startsWith("image/") && !mimeType.startsWith("application/")) {
      return res.status(400).json({ error: `Unsupported MIME type: ${mimeType}` });
    }

    // Generate unique, cryptographically secure object key if not explicitly given
    let storageKey = (req.query?.key as string) || req.body?.key || req.body?.storageKey;
    if (!storageKey) {
      const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const randomHex = crypto.randomBytes(6).toString("hex");
      const timestamp = Date.now();
      const folder = req.body?.folder || req.query?.folder || "notes";
      storageKey = `${folder}/${timestamp}-${randomHex}-${sanitizedName}`;
    }

    storageKey = String(storageKey).replace(/^\/+/, "");

    const result = await uploadObjectToR2({
      bucket,
      key: storageKey,
      body: buffer,
      contentType: mimeType,
    });

    // Return strictly metadata per specification (no signed URL)
    return res.status(200).json({
      success: true,
      bucket: result.bucket,
      storageKey: result.key,
      mimeType,
      fileSize: buffer.length,
      originalFilename,
    });
  } catch (err: any) {
    console.error("[Vercel R2] Upload error:", err);
    return res.status(500).json({
      error: err.message || "Failed to upload file to Cloudflare R2.",
    });
  }
}
