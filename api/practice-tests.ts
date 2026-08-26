import { handleOptions, sendSuccess, sendError } from "./_lib/responses";
import { validateAction } from "./_lib/validation";
import { sanitizeKey, getMimeType } from "./_lib/utils";
import { uploadObjectToR2, deleteObjectFromR2, getObjectFromR2, getR2ServerConfig } from "./_lib/r2";
import { PracticeTestsAction } from "./_shared/types";

export const runtime = "nodejs";

const ALLOWED_ACTIONS = [
  "upload",
  "save",
  "update",
  "delete",
  "list",
  "get",
  "publish",
  "archive",
  "download",
  "delete-all",
] as const;

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;

  try {
    const actionParam = req.query.action || req.body?.action || (req.method === "GET" ? "get" : "upload");
    const action = validateAction<PracticeTestsAction>(actionParam, ALLOWED_ACTIONS, "list");

    switch (action) {
      // 1. SAVE / UPLOAD PRACTICE TEST
      case "upload":
      case "save": {
        const { classGrade, subject, chapterNo, chapterName, topicName, questions, rawText, fileName, base64 } = req.body || {};

        if (!classGrade || !subject || !chapterName) {
          return res.status(400).json({ error: "Missing required practice test fields (classGrade, subject, chapterName)." });
        }

        let storageKey = "";
        let jsonUrl = "";

        if (questions && Array.isArray(questions)) {
          const testData = {
            classGrade,
            subject,
            chapterNo: Number(chapterNo) || 1,
            chapterName,
            topicName: topicName || "",
            questions,
            rawText: rawText || "",
            savedAt: new Date().toISOString(),
          };

          storageKey = `practice-tests/${classGrade}/${subject}/test_${Date.now()}.json`;
          const buffer = Buffer.from(JSON.stringify(testData, null, 2), "utf-8");

          await uploadObjectToR2({
            key: storageKey,
            body: buffer,
            contentType: "application/json",
          });

          const config = getR2ServerConfig();
          jsonUrl = config.publicUrl
            ? `${config.publicUrl}/${storageKey}`
            : `/api/storage?action=download&key=${encodeURIComponent(storageKey)}`;
        }

        return sendSuccess(res, {
          id: `test_${Date.now()}`,
          storageKey,
          jsonUrl,
          totalQuestions: (questions || []).length,
          message: "Practice test saved successfully.",
        });
      }

      // 2. DELETE PRACTICE TEST
      case "delete": {
        const { id, storageKey, bucket } = req.body || req.query;
        if (storageKey) {
          try {
            await deleteObjectFromR2({ bucket, key: sanitizeKey(storageKey) });
          } catch (delErr) {
            console.warn("[Practice Tests API] R2 asset deletion warning:", delErr);
          }
        }
        return sendSuccess(res, { deleted: true, id, storageKey });
      }

      // 3. GET / DOWNLOAD PRACTICE TEST
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
          return res.status(404).send("Practice test file not found.");
        }

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return obj.body.pipe(res);
      }

      // 4. LIST
      case "list": {
        return sendSuccess(res, { tests: [], total: 0 });
      }

      default:
        return res.status(400).json({ error: `Unsupported practice tests action: ${action}` });
    }
  } catch (err: any) {
    return sendError(res, err, "Practice test operation failed.");
  }
}
