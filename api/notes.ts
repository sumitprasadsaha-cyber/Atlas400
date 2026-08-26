import { handleOptions, sendSuccess, sendError } from "./_lib/responses";
import { validateAction } from "./_lib/validation";
import { sanitizeKey, getMimeType, parseRequestBody } from "./_lib/utils";
import { uploadObjectToR2, deleteObjectFromR2, getObjectFromR2, headObjectFromR2, getR2ServerConfig } from "./_lib/r2";
import { NotesAction } from "./_shared/types";

export const runtime = "nodejs";

const ALLOWED_ACTIONS = [
  "create",
  "update",
  "replace",
  "delete",
  "list",
  "get",
  "download",
] as const;

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;

  try {
    const parsedBody = parseRequestBody(req.body);
    const actionParam = req.query.action || parsedBody?.action || (req.method === "GET" ? "get" : "create");
    const action = validateAction<NotesAction>(actionParam, ALLOWED_ACTIONS, "list");

    switch (action) {
      // 1. CREATE / UPLOAD NOTE
      case "create": {
        const { title, subject, classGrade, chapterNo, chapterName, topicName, fileName, base64, mimeType, bucket } = parsedBody || req.body || {};
        if (!title || !subject || !classGrade) {
          return res.status(400).json({ success: false, error: "Missing required note metadata (title, subject, classGrade)." });
        }

        let storageKey = "";
        let fileUrl = "";
        let size = 0;

        if (base64 && fileName) {
          const extension = fileName.split(".").pop() || "pdf";
          storageKey = `notes/${classGrade}/${subject}/note_${Date.now()}.${extension}`;
          const buffer = Buffer.from(base64, "base64");
          size = buffer.length;

          const uploadRes = await uploadObjectToR2({
            bucket,
            key: storageKey,
            body: buffer,
            contentType: mimeType || getMimeType(fileName),
          });

          const config = getR2ServerConfig();
          fileUrl = config.publicUrl
            ? `${config.publicUrl}/${storageKey}`
            : `/api/storage?action=download&key=${encodeURIComponent(storageKey)}`;
        }

        const noteRecord = {
          id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title,
          subject,
          classGrade,
          chapterNo: Number(chapterNo) || 1,
          chapterName: chapterName || "",
          topicName: topicName || "",
          fileName: fileName || "",
          storageKey,
          fileUrl,
          fileSize: size,
          mimeType: mimeType || getMimeType(fileName || ""),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return sendSuccess(res, { note: noteRecord, message: "Note created successfully." });
      }

      // 2. DELETE NOTE & ASSOCIATED R2 ASSET
      case "delete": {
        const { id, storageKey, bucket } = req.body || req.query;
        if (storageKey) {
          try {
            await deleteObjectFromR2({ bucket, key: sanitizeKey(storageKey) });
          } catch (delErr) {
            console.warn("[Notes API] R2 asset deletion warning:", delErr);
          }
        }
        return sendSuccess(res, { deleted: true, id, storageKey });
      }

      // 3. ATOMIC REPLACE NOTE ASSET
      case "replace": {
        const { id, oldStorageKey, newFileName, base64, mimeType, bucket } = req.body || {};
        if (oldStorageKey) {
          try {
            await deleteObjectFromR2({ bucket, key: sanitizeKey(oldStorageKey) });
          } catch (delErr) {
            console.warn("[Notes API] Old note asset deletion warning:", delErr);
          }
        }

        let newStorageKey = "";
        let newFileUrl = "";
        let size = 0;

        if (base64 && newFileName) {
          const extension = newFileName.split(".").pop() || "pdf";
          newStorageKey = `notes/replaced_${Date.now()}.${extension}`;
          const buffer = Buffer.from(base64, "base64");
          size = buffer.length;

          await uploadObjectToR2({
            bucket,
            key: newStorageKey,
            body: buffer,
            contentType: mimeType || getMimeType(newFileName),
          });

          const config = getR2ServerConfig();
          newFileUrl = config.publicUrl
            ? `${config.publicUrl}/${newStorageKey}`
            : `/api/storage?action=download&key=${encodeURIComponent(newStorageKey)}`;
        }

        return sendSuccess(res, {
          replaced: true,
          id,
          storageKey: newStorageKey,
          fileUrl: newFileUrl,
          fileSize: size,
        });
      }

      // 4. GET / DOWNLOAD NOTE
      case "get":
      case "download": {
        const storageKey = req.query.storageKey || req.query.key || req.body?.storageKey;
        if (!storageKey) {
          return res.status(400).json({ error: "Missing required 'storageKey' parameter." });
        }

        const cleanKey = sanitizeKey(String(storageKey));
        const config = getR2ServerConfig();
        const obj = await getObjectFromR2({ bucket: config.bucket, key: cleanKey });

        if (!obj.body) {
          return res.status(404).send("Note file not found.");
        }

        res.setHeader("Content-Type", obj.contentType || getMimeType(cleanKey));
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return obj.body.pipe(res);
      }

      // 5. LIST
      case "list": {
        return sendSuccess(res, { notes: [], total: 0 });
      }

      default:
        return res.status(400).json({ error: `Unsupported notes action: ${action}` });
    }
  } catch (err: any) {
    return sendError(res, err, "Notes operation failed.");
  }
}
