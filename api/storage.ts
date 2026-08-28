import { pipeline } from "stream";
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
  isR2Configured,
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

/**
 * Extracts and merges parameters from query string, parsed body, and raw body.
 */
function extractCombinedParams(req: any, parsedBody: any): Record<string, any> {
  const query = req.query && typeof req.query === "object" ? req.query : {};
  const body = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? req.body : {};
  const parsed = parsedBody && typeof parsedBody === "object" && !Buffer.isBuffer(parsedBody) ? parsedBody : {};
  return { ...query, ...body, ...parsed };
}

/**
 * Resolves the target storage key from any candidate property or query string.
 */
function resolveStorageKey(params: Record<string, any>, actualBucket: string): string {
  const rawKey =
    params.key ||
    params.storageKey ||
    params.storagePath ||
    params.storage_key ||
    params.storage_path ||
    params.objectKey ||
    params.r2Key ||
    params.path ||
    params.fileUrl ||
    params.url ||
    "";

  if (!rawKey) return "";
  return sanitizeKey(String(rawKey), actualBucket);
}

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;

  try {
    const parsedBody = parseRequestBody(req.body);
    const params = extractCombinedParams(req, parsedBody);

    // Determine action from query, body, or URL
    const actionParam =
      params.action ||
      (req.method === "GET" && (params.key || params.storageKey || params.storagePath) ? "download" : "upload");
    const action = validateAction<StorageAction>(actionParam, ALLOWED_ACTIONS, "download");

    const config = getR2ServerConfig();
    const actualBucket = (params.bucket || config.bucket || "academy-connect-files").trim();

    switch (action) {
      // 1. GENERATE SIGNED URL
      case "signed-url": {
        const cleanKey = resolveStorageKey(params, actualBucket);
        if (!cleanKey) {
          return sendError(
            res,
            new Error("Storage metadata missing: Missing required 'key' or 'storageKey' parameter."),
            "Storage metadata missing",
            "STORAGE_METADATA_MISSING"
          );
        }

        let headStatus = 200;
        let headContentType = params.contentType || getMimeType(cleanKey);
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

        try {
          const signedUrl = await generateR2SignedUrl({
            bucket: actualBucket,
            key: effectiveKey,
            expiresIn: Number(params.expiresIn) || 3600,
            operation: params.operation === "putObject" ? "putObject" : "getObject",
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
        } catch (signErr: any) {
          console.error("[Storage API] Signed URL generation failed:", signErr);
          return sendError(
            res,
            signErr,
            "Signed URL generation failed",
            "SIGNED_URL_FAILED"
          );
        }
      }

      // 2. UPLOAD FILE
      case "upload": {
        let payload;
        try {
          payload = await extractUploadPayload(req);
        } catch (extractErr: any) {
          console.error("[Storage API] Error extracting upload payload:", extractErr);
          return sendError(
            res,
            extractErr,
            "Failed to parse upload request body or multipart data.",
            "INVALID_UPLOAD_PAYLOAD"
          );
        }

        const rawKey = payload.key || params.key || params.storageKey || params.storagePath;
        const cleanKey = rawKey ? sanitizeKey(String(rawKey), actualBucket) : "";
        const contentType =
          payload.contentType ||
          params.mimeType ||
          params.contentType ||
          getMimeType(cleanKey || payload.fileName || "file.pdf");

        if (!cleanKey) {
          return sendError(
            res,
            new Error("Storage metadata missing: Missing required 'key' or 'storageKey'."),
            "Storage metadata missing",
            "STORAGE_METADATA_MISSING"
          );
        }

        if (!payload.buffer || payload.buffer.length === 0) {
          return sendError(
            res,
            new Error("Upload buffer is empty or no valid file data received."),
            "Upload buffer is empty",
            "EMPTY_BUFFER"
          );
        }

        // File size limit (50MB)
        const MAX_STORAGE_SIZE = 50 * 1024 * 1024;
        if (payload.buffer.length > MAX_STORAGE_SIZE) {
          return sendError(
            res,
            new Error("File size exceeds limit. Maximum allowed size is 50 MB."),
            "File size exceeds limit",
            "FILE_TOO_LARGE"
          );
        }

        try {
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
        } catch (uploadErr: any) {
          console.error("[Storage API] Upload execution error:", uploadErr);
          return sendError(
            res,
            uploadErr,
            "Cloudflare R2 unavailable or bucket upload failed.",
            "R2_UNAVAILABLE"
          );
        }
      }

      // 3. DOWNLOAD / STREAM FILE INLINE OR ATTACHMENT
      case "download": {
        const cleanKey = resolveStorageKey(params, actualBucket);
        if (!cleanKey) {
          return sendError(
            res,
            new Error("Invalid storage key: Missing or empty 'key' parameter."),
            "Invalid storage key",
            "INVALID_STORAGE_KEY"
          );
        }

        // Handle HEAD request
        if (req.method === "HEAD") {
          try {
            const head = await headObjectFromR2({ bucket: actualBucket, key: cleanKey });
            if (!head.exists) {
              setCorsHeaders(res);
              return res.status(404).end();
            }

            const contentType = params.mimeType || head.contentType || getMimeType(cleanKey);
            setCorsHeaders(res);
            res.setHeader("Content-Type", contentType);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            if (head.etag) res.setHeader("ETag", head.etag);
            if (head.contentLength) res.setHeader("Content-Length", head.contentLength);
            return res.status(200).end();
          } catch (headErr) {
            setCorsHeaders(res);
            return res.status(404).end();
          }
        }

        const range = req.headers.range;
        let obj;
        try {
          obj = await getObjectFromR2({ bucket: actualBucket, key: cleanKey, range });
        } catch (getErr: any) {
          console.error("[Storage API] getObjectFromR2 error:", getErr);
          return sendError(
            res,
            getErr,
            "Cloudflare R2 unavailable",
            "R2_UNAVAILABLE"
          );
        }

        if (!obj || !obj.body) {
          return sendError(
            res,
            new Error(`Object not found: "${cleanKey}" does not exist in bucket "${actualBucket}".`),
            "Object not found",
            "OBJECT_NOT_FOUND"
          );
        }

        const contentType = params.mimeType || obj.contentType || getMimeType(cleanKey);
        const fileName = (params.filename as string) || cleanKey.split("/").pop() || "note.pdf";
        const isAttachment = params.download === "true" || params.download === true;

        setCorsHeaders(res);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

        if (obj.etag) res.setHeader("ETag", obj.etag);
        if (obj.contentRange) {
          res.status(206);
          res.setHeader("Content-Range", obj.contentRange);
        }
        if (obj.contentLength) {
          res.setHeader("Content-Length", obj.contentLength);
        }

        // Set Content-Disposition: inline for topic viewing, attachment for download
        const dispositionType = isAttachment ? "attachment" : "inline";
        res.setHeader("Content-Disposition", `${dispositionType}; filename="${encodeURIComponent(fileName)}"`);

        // Safely stream through pipeline and await completion so Vercel does not terminate execution prematurely
        return await new Promise<void>((resolve) => {
          pipeline(obj.body, res, (err) => {
            if (err) {
              // Log stream transmission issue without crashing serverless lambda
              console.warn("[Storage API] Stream pipeline finished with notice:", err?.message || err);
              if (!res.headersSent) {
                sendError(res, err, "Stream transmission error", "STREAM_ERROR");
              }
            }
            resolve();
          });
        });
      }

      // 4. CHECK OBJECT EXISTENCE (EXISTS / VERIFY / HEAD)
      case "exists":
      case "verify":
      case "head": {
        const cleanKey = resolveStorageKey(params, actualBucket);
        if (!cleanKey) {
          return sendSuccess(res, { exists: false, error: "Missing required 'key' parameter." });
        }

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
        const cleanKey = resolveStorageKey(params, actualBucket);
        if (!cleanKey) {
          return sendError(
            res,
            new Error("Missing required 'key' parameter for deletion."),
            "Invalid storage key",
            "INVALID_STORAGE_KEY"
          );
        }

        console.log(`[Storage API] Deleting object from Cloudflare R2: bucket="${actualBucket}", key="${cleanKey}"`);
        const result = await deleteObjectFromR2({ bucket: actualBucket, key: cleanKey });
        return sendSuccess(res, { success: true, deleted: true, ...result });
      }

      // 6. DELETE MULTIPLE OBJECTS
      case "delete-multiple": {
        let keys = params.keys;
        if (typeof keys === "string") {
          try {
            keys = JSON.parse(keys);
          } catch {
            keys = keys.split(",").map((k: string) => k.trim());
          }
        }

        if (!keys || !Array.isArray(keys) || keys.length === 0) {
          return sendError(
            res,
            new Error("Missing or invalid 'keys' array parameter."),
            "Invalid keys parameter",
            "INVALID_KEYS"
          );
        }

        const cleanKeys = keys.map((k) => sanitizeKey(k, actualBucket)).filter(Boolean);
        console.log(`[Storage API] Deleting multiple objects from Cloudflare R2: bucket="${actualBucket}", count=${cleanKeys.length}`);
        const result = await deleteObjectsFromR2({ bucket: actualBucket, keys: cleanKeys });
        return sendSuccess(res, { success: true, ...result });
      }

      // 7. ATOMIC REPLACE
      case "replace": {
        const oldKey = params.oldKey || params.oldStoragePath;
        const newKey = params.newKey || params.newStoragePath || params.key;
        const base64 = params.base64;
        const mimeType = params.mimeType || "application/octet-stream";

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
        const cleanPrefix = params.prefix ? sanitizeKey(params.prefix, actualBucket) : "";
        const result = await listObjectsFromR2({
          bucket: actualBucket,
          prefix: cleanPrefix,
          maxKeys: Number(params.limit) || 1000,
          continuationToken: params.continuationToken,
        });
        return sendSuccess(res, result);
      }

      default:
        return sendError(
          res,
          new Error(`Unsupported storage action: ${action}`),
          "Unsupported storage action",
          "INVALID_ACTION"
        );
    }
  } catch (err: any) {
    return sendError(res, err, "Storage operation failed.", "STORAGE_OPERATION_FAILED");
  }
}
