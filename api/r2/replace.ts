import { uploadObjectToR2, deleteObjectFromR2, headObjectFromR2, getR2ServerConfig } from "../_lib/r2Server";
import crypto from "crypto";
import {
  validateNoteUploadFile,
  generateR2ObjectKey,
} from "../../shared/validation/note.validator";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, PATCH, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST" && req.method !== "PATCH" && req.method !== "PUT") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use POST or PATCH." } });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    body = body || {};

    const oldKey = body.oldKey || body.oldR2ObjectKey || body.oldStoragePath || body.oldStorageKey || req.query?.oldKey;
    const batch = body.batch || req.query?.batch || "all-batches";
    const subject = body.subject || req.query?.subject || "general";
    let rawFilename = body.fileName || body.originalFileName || body.originalFilename || req.query?.fileName || "document.pdf";
    let mimeType = body.mimeType || req.query?.mimeType || req.headers?.["content-type"] || "application/octet-stream";

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (body && body.base64) {
      buffer = Buffer.from(body.base64, "base64");
    } else {
      return res.status(400).json({ success: false, error: { message: "No replacement file buffer or base64 provided." } });
    }

    // 1. Validate replacement file
    const validation = validateNoteUploadFile(buffer.length, rawFilename, mimeType);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: { message: validation.error || "Replacement file validation failed." } });
    }

    const config = getR2ServerConfig();
    const bucket = (body.bucket || (req.query?.bucket as string) || config.bucket || "academy-connect-files").trim();

    // 2. Generate new unique R2 object key
    const uuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    const newStorageKey = generateR2ObjectKey(batch, subject, validation.extension, uuid);

    // 3. Upload new file first
    const uploadResult = await uploadObjectToR2({
      bucket,
      key: newStorageKey,
      body: buffer,
      contentType: validation.cleanMime,
    });

    // 4. Verify new object upload
    const newHead = await headObjectFromR2({ bucket, key: newStorageKey });
    if (!newHead.exists) {
      throw new Error(`Replacement upload verification failed for new key '${newStorageKey}'.`);
    }

    // 5. Delete previous R2 object permanently if provided
    let oldKeyDeleted = false;
    if (oldKey) {
      const cleanOldKey = String(oldKey).replace(/^\/+/, "");
      try {
        await deleteObjectFromR2({ bucket, key: cleanOldKey });
        const oldVerify = await headObjectFromR2({ bucket, key: cleanOldKey });
        oldKeyDeleted = !oldVerify.exists;
        console.log(`[R2 Replace] Old object deleted: ${cleanOldKey} (verified: ${oldKeyDeleted})`);
      } catch (delErr) {
        console.warn(`[R2 Replace] Notice: Old object deletion notice for '${cleanOldKey}':`, delErr);
      }
    }

    // 6. Return structured replacement result
    return res.status(200).json({
      success: true,
      data: {
        bucket: uploadResult.bucket,
        storageKey: uploadResult.key,
        r2ObjectKey: uploadResult.key,
        oldR2ObjectKey: oldKey ? String(oldKey).replace(/^\/+/, "") : null,
        oldKeyDeleted,
        fileName: validation.cleanName,
        originalFileName: validation.cleanName,
        mimeType: validation.cleanMime,
        extension: validation.extension,
        size: buffer.length,
        fileSize: buffer.length,
        etag: uploadResult.etag || newHead.etag,
        replaced: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Serverless R2] Replace error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to replace file in Cloudflare R2.",
        details: err.stack,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
