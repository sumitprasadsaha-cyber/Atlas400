import { handleOptions, sendSuccess, sendError, setCorsHeaders } from "./_lib/responses";
import { validateAction } from "./_lib/validation";
import { sanitizeKey, getMimeType, parseRequestBody, extractUploadPayload } from "./_lib/utils";
import {
  uploadObjectToR2,
  getObjectFromR2,
  generateR2SignedUrl,
  deleteObjectFromR2,
  deleteObjectsFromR2,
  listObjectsFromR2,
  headObjectFromR2,
  getR2ServerConfig,
} from "./_lib/r2";
import { StorageAction } from "./_shared/types";

export const runtime = "nodejs";

const ALLOWED_ACTIONS = [
  "upload",
  "download",
  "signed-url",
  "delete",
  "delete-multiple",
  "replace",
  "list",
  "exists",
  "verify",
  "head",
] as const;

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;

  try {
    const parsedBody = parseRequestBody(req.body);
    // Determine action from query, body, or URL
    const actionParam = req.query.action || parsedBody?.action || (req.method === "GET" && req.query.key ? "download" : "upload");
    const action = validateAction<StorageAction>(actionParam, ALLOWED_ACTIONS, "download");

    switch (action) {
      // 1. GENERATE SIGNED URL
      case "signed-url": {
        const { bucket, key, expiresIn, operation, contentType } = parsedBody || req.body || req.query;
        if (!key) {
          return res.status(400).json({ success: false, error: "Missing required 'key' parameter." });
        }

        const config = getR2ServerConfig();
        const actualBucket = (bucket || config.bucket || "academy-connect-files").trim();
        const cleanKey = sanitizeKey(key, actualBucket);

        let headStatus = 200;
        let headContentType = contentType || getMimeType(cleanKey);
        let headContentLength = 0;
        let exists = true;
        let effectiveKey = cleanKey;

        try {
          const headCheck = await headObjectFromR2({ bucket: actualBucket, key: cleanKey });
          exists = headCheck.exists;
          headStatus = headCheck.exists ? 200 : 404;
          if (headCheck.contentType) headContentType = headCheck.contentType;
          if (headCheck.contentLength) headContentLength = headCheck.contentLength;
          if (headCheck.resolvedKey) effectiveKey = headCheck.resolvedKey;
        } catch (headErr: any) {
          console.warn("[Storage API] Head verification warning:", headErr?.message || headErr);
        }

        const signedUrl = await generateR2SignedUrl({
          bucket: actualBucket,
          key: effectiveKey,
          expiresIn: Number(expiresIn) || 3600,
          operation: operation === "putObject" ? "putObject" : "getObject",
          contentType: headContentType,
        });

        return sendSuccess(res, {
          signedUrl,
          exists,
          status: headStatus,
          contentType: headContentType,
          contentLength: headContentLength,
          bucket: actualBucket,
          key: effectiveKey,
        });
      }

      // 2. UPLOAD FILE
      case "upload": {
        const payload = await extractUploadPayload(req);
        const bucket = (req.query.bucket as string) || (parsedBody?.bucket as string) || payload.bucket;
        const key = (req.query.key as string) || (parsedBody?.key as string) || payload.key;
        const contentType = payload.contentType || (req.query.mimeType as string) || (parsedBody?.mimeType as string) || getMimeType(key || payload.fileName || "file.pdf");

        if (!key) {
          return res.status(400).json({ error: "Missing required 'key' query parameter, form field, or body property." });
        }

        if (!payload.buffer || payload.buffer.length === 0) {
          return res.status(400).json({ error: "Upload buffer is empty or no valid file/body data received." });
        }

        const config = getR2ServerConfig();
        const actualBucket = (bucket || config.bucket || "academy-connect-files").trim();
        const cleanKey = sanitizeKey(key, actualBucket);

        const result = await uploadObjectToR2({
          bucket: actualBucket,
          key: cleanKey,
          body: payload.buffer,
          contentType,
        });

        const downloadUrl = `/api/storage?action=download&bucket=${encodeURIComponent(result.bucket)}&key=${encodeURIComponent(cleanKey)}`;
        const publicUrl = config.publicUrl
          ? `${config.publicUrl}/${cleanKey}`
          : downloadUrl;

        return sendSuccess(res, {
          bucket: result.bucket,
          key: result.key,
          etag: result.etag,
          url: downloadUrl,
          publicUrl: publicUrl,
          size: payload.buffer.length,
          mimeType: contentType,
          filename: payload.fileName,
        });
      }

      // 3. DOWNLOAD / STREAM FILE
      case "download": {
        const bucket = (req.query.bucket as string) || req.body?.bucket;
        const key = (req.query.key as string) || req.body?.key;

        if (!key) {
          return res.status(400).send("Missing required 'key' parameter.");
        }

        const config = getR2ServerConfig();
        const actualBucket = bucket || config.bucket || "academy-connect-files";
        const cleanKey = sanitizeKey(key, actualBucket);

        // If HEAD request
        if (req.method === "HEAD") {
          const head = await headObjectFromR2({ bucket: actualBucket, key: cleanKey });
          if (!head.exists) return res.status(404).end();

          const contentType = (req.query.mimeType as string) || head.contentType || getMimeType(cleanKey);
          setCorsHeaders(res);
          res.setHeader("Content-Type", contentType);
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          if (head.etag) res.setHeader("ETag", head.etag);
          if (head.contentLength) res.setHeader("Content-Length", head.contentLength);
          return res.status(200).end();
        }

        const range = req.headers.range;
        const obj = await getObjectFromR2({ bucket: actualBucket, key: cleanKey, range });

        if (!obj.body) {
          return res.status(404).send("File not found in storage.");
        }

        const contentType = (req.query.mimeType as string) || obj.contentType || getMimeType(cleanKey);
        setCorsHeaders(res);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

        if (obj.etag) res.setHeader("ETag", obj.etag);
        if (obj.contentRange) {
          res.status(206);
          res.setHeader("Content-Range", obj.contentRange);
        }
        if (obj.contentLength) res.setHeader("Content-Length", obj.contentLength);

        if (req.query.download === "true" || req.query.filename) {
          const downloadFilename = (req.query.filename as string) || cleanKey.split("/").pop() || "download";
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
        }

        return obj.body.pipe(res);
      }

      // 4. CHECK OBJECT EXISTENCE (EXISTS / VERIFY / HEAD)
      case "exists":
      case "verify":
      case "head": {
        const bucket = (req.query.bucket as string) || req.body?.bucket;
        const key = (req.query.key as string) || req.body?.key || req.body?.storageKey || req.body?.storagePath;

        if (!key) {
          return res.status(400).json({ exists: false, error: "Missing required 'key' parameter." });
        }

        const config = getR2ServerConfig();
        const actualBucket = bucket || config.bucket || "academy-connect-files";
        const cleanKey = sanitizeKey(key, actualBucket);
        const head = await headObjectFromR2({ bucket: actualBucket, key: cleanKey });

        return sendSuccess(res, {
          exists: head.exists,
          bucket: actualBucket,
          key: cleanKey,
          contentLength: head.contentLength,
          contentType: head.contentType || getMimeType(cleanKey),
          etag: head.etag,
          lastModified: head.lastModified,
        });
      }

      // 5. DELETE SINGLE OBJECT
      case "delete": {
        const bucket = parsedBody?.bucket || req.body?.bucket || (req.query.bucket as string);
        const key =
          parsedBody?.key ||
          parsedBody?.storagePath ||
          parsedBody?.storageKey ||
          parsedBody?.path ||
          req.body?.key ||
          req.body?.storagePath ||
          req.body?.storageKey ||
          req.body?.path ||
          (req.query.key as string) ||
          (req.query.storagePath as string) ||
          (req.query.storageKey as string) ||
          (req.query.path as string);

        if (!key) {
          return res.status(400).json({ success: false, error: "Missing required 'key' parameter for deletion." });
        }

        const config = getR2ServerConfig();
        const actualBucket = (bucket || config.bucket || "academy-connect-files").trim();
        const cleanKey = sanitizeKey(String(key), actualBucket);

        if (!cleanKey) {
          return res.status(400).json({ success: false, error: "Invalid or empty storage key provided." });
        }

        console.log(`[Storage API] Deleting object from Cloudflare R2: bucket="${actualBucket}", key="${cleanKey}"`);
        const result = await deleteObjectFromR2({ bucket: actualBucket, key: cleanKey });
        return sendSuccess(res, { success: true, deleted: true, ...result });
      }

      // 6. DELETE MULTIPLE OBJECTS
      case "delete-multiple": {
        const bucket = parsedBody?.bucket || req.body?.bucket || (req.query.bucket as string);
        let keys = parsedBody?.keys || req.body?.keys || req.query?.keys;
        if (typeof keys === "string") {
          try {
            keys = JSON.parse(keys);
          } catch {
            keys = keys.split(",").map((k: string) => k.trim());
          }
        }

        if (!keys || !Array.isArray(keys) || keys.length === 0) {
          return res.status(400).json({ success: false, error: "Missing or invalid 'keys' array parameter." });
        }

        const config = getR2ServerConfig();
        const actualBucket = (bucket || config.bucket || "academy-connect-files").trim();
        const cleanKeys = keys.map((k) => sanitizeKey(k, actualBucket)).filter(Boolean);

        console.log(`[Storage API] Deleting multiple objects from Cloudflare R2: bucket="${actualBucket}", count=${cleanKeys.length}`);
        const result = await deleteObjectsFromR2({ bucket: actualBucket, keys: cleanKeys });
        return sendSuccess(res, { success: true, ...result });
      }

      // 7. ATOMIC REPLACE
      case "replace": {
        const bucket = (req.query.bucket as string) || parsedBody?.bucket || req.body?.bucket;
        const oldKey = parsedBody?.oldKey || parsedBody?.oldStoragePath || req.body?.oldKey || req.body?.oldStoragePath || (req.query.oldKey as string);
        const newKey = parsedBody?.newKey || parsedBody?.newStoragePath || parsedBody?.key || req.body?.newKey || req.body?.newStoragePath || req.body?.key || (req.query.key as string);
        const base64 = parsedBody?.base64 || req.body?.base64;
        const mimeType = parsedBody?.mimeType || req.body?.mimeType || (req.query.mimeType as string) || "application/octet-stream";

        const config = getR2ServerConfig();
        const actualBucket = (bucket || config.bucket || "academy-connect-files").trim();

        if (oldKey) {
          try {
            const cleanOldKey = sanitizeKey(oldKey, actualBucket);
            await deleteObjectFromR2({ bucket: actualBucket, key: cleanOldKey });
          } catch (delErr) {
            console.warn(`[Storage API] Old object was not found or already deleted: ${oldKey}`, delErr);
          }
        }

        if (newKey && base64) {
          const cleanNewKey = sanitizeKey(newKey, actualBucket);
          const buffer = Buffer.from(base64, "base64");
          const uploadRes = await uploadObjectToR2({
            bucket: actualBucket,
            key: cleanNewKey,
            body: buffer,
            contentType: mimeType,
          });

          const downloadUrl = `/api/storage?action=download&bucket=${encodeURIComponent(uploadRes.bucket)}&key=${encodeURIComponent(cleanNewKey)}`;
          const publicUrl = config.publicUrl
            ? `${config.publicUrl}/${cleanNewKey}`
            : downloadUrl;

          return sendSuccess(res, {
            bucket: uploadRes.bucket,
            key: uploadRes.key,
            etag: uploadRes.etag,
            url: downloadUrl,
            publicUrl,
            size: buffer.length,
            mimeType,
            replaced: true,
          });
        }

        return sendSuccess(res, {
          oldKeyDeleted: Boolean(oldKey),
          message: "Replace processed successfully.",
        });
      }

      // 8. LIST OBJECTS
      case "list": {
        const { bucket, prefix, limit, continuationToken } = req.body || req.query;
        const cleanPrefix = prefix ? sanitizeKey(prefix, bucket) : "";
        const result = await listObjectsFromR2({
          bucket,
          prefix: cleanPrefix,
          maxKeys: Number(limit) || 1000,
          continuationToken,
        });
        return sendSuccess(res, result);
      }

      default:
        return res.status(400).json({ error: `Unsupported storage action: ${action}` });
    }
  } catch (err: any) {
    return sendError(res, err, "Storage operation failed.");
  }
}
