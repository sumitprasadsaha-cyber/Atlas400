import { uploadObjectToR2, headObjectFromR2, getR2ServerConfig } from "../_lib/r2Server";
import crypto from "crypto";
import {
  validateNoteUploadFile,
  generateR2ObjectKey,
  sanitizeVirusSafeFilename,
  extractFileExtension,
} from "../../shared/validation/note.validator";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use POST." } });
  }

  try {
    const config = getR2ServerConfig();
    const bucket = ((req.query?.bucket as string) || req.body?.bucket || config.bucket || "academy-connect-files").trim();

    let rawFilename = (req.query?.fileName as string) || req.body?.fileName || req.body?.originalFileName || req.body?.originalFilename || "document.pdf";
    let mimeType = (req.query?.mimeType as string) || req.body?.mimeType || req.headers?.["content-type"] || "application/octet-stream";
    const batch = (req.query?.batch as string) || req.body?.batch || "all-batches";
    const subject = (req.query?.subject as string) || req.body?.subject || "general";

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body && typeof req.body === "object" && req.body.base64) {
      buffer = Buffer.from(req.body.base64, "base64");
      if (req.body.fileName) rawFilename = req.body.fileName;
      if (req.body.originalFileName) rawFilename = req.body.originalFileName;
      if (req.body.mimeType) mimeType = req.body.mimeType;
    } else if (typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        if (parsed.base64) {
          buffer = Buffer.from(parsed.base64, "base64");
          if (parsed.fileName) rawFilename = parsed.fileName;
          if (parsed.originalFileName) rawFilename = parsed.originalFileName;
          if (parsed.mimeType) mimeType = parsed.mimeType;
        } else {
          buffer = Buffer.from(req.body, "utf-8");
        }
      } catch {
        buffer = Buffer.from(req.body, "utf-8");
      }
    } else {
      return res.status(400).json({ success: false, error: { message: "No upload file body received." } });
    }

    // Comprehensive validation per Phase 3 requirements
    const validation = validateNoteUploadFile(buffer.length, rawFilename, mimeType);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: { message: validation.error || "File validation failed." } });
    }

    // Cryptographic UUID & structured object key: notes/{batch}/{subject}/{uuid}.{ext}
    const uuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    let storageKey = (req.query?.key as string) || req.body?.key || req.body?.storageKey || req.body?.r2ObjectKey;
    if (!storageKey) {
      storageKey = generateR2ObjectKey(batch, subject, validation.extension, uuid);
    }
    storageKey = String(storageKey).replace(/^\/+/, "");

    // 1. Upload to Cloudflare R2
    const uploadResult = await uploadObjectToR2({
      bucket,
      key: storageKey,
      body: buffer,
      contentType: validation.cleanMime,
    });

    // 2. Verify upload existence
    const verifyHead = await headObjectFromR2({ bucket, key: storageKey });
    if (!verifyHead.exists) {
      throw new Error(`Upload verification failed for storage key '${storageKey}'.`);
    }

    // 3. Return verified response strictly as metadata
    return res.status(200).json({
      success: true,
      data: {
        bucket: uploadResult.bucket,
        storageKey: uploadResult.key,
        r2ObjectKey: uploadResult.key,
        fileName: validation.cleanName,
        originalFileName: validation.cleanName,
        mimeType: validation.cleanMime,
        extension: validation.extension,
        size: buffer.length,
        fileSize: buffer.length,
        etag: uploadResult.etag || verifyHead.etag,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Serverless R2] Upload error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to upload file to Cloudflare R2.",
        details: err.stack,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
