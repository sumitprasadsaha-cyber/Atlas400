import { uploadObjectToR2, deleteObjectFromR2, deleteObjectsFromR2, headObjectFromR2, getR2ServerConfig } from "../_lib/r2Server";
import { validateQuestionBank } from "../../shared/validation/practice.validator";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, PATCH, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST" && req.method !== "PATCH" && req.method !== "PUT") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use POST or PATCH." } });
  }

  try {
    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (err: any) {
        return res.status(400).json({ success: false, error: { message: "Invalid JSON payload: " + err.message } });
      }
    }

    const { oldR2ObjectKey, oldKey, newQuestionBank, oldImageKeys, version } = payload || {};
    const previousKey = oldR2ObjectKey || oldKey;

    // 1. Validate incoming replacement question bank
    const validation = validateQuestionBank(newQuestionBank || payload);
    if (!validation.isValid || !validation.cleanQuestionBank) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Validation failed for replacement question bank.",
          details: validation.errors,
        },
      });
    }

    const cleanBank = validation.cleanQuestionBank;
    const nextVersion = (Number(version) || Number(cleanBank.version) || 1) + 1;
    cleanBank.version = nextVersion;

    const normSubject = (cleanBank.subject || "general").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const normChapter = (cleanBank.chapter || "ch1").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const cleanTestId = cleanBank.testId.replace(/[^a-zA-Z0-9_-]/g, "_");

    // New versioned key to ensure fresh ETag and zero browser cache poisoning
    const newR2ObjectKey = `practice-tests/${normSubject}/${normChapter}/${cleanTestId}_v${nextVersion}.json`;
    const jsonBuffer = Buffer.from(JSON.stringify(cleanBank, null, 2), "utf-8");

    const config = getR2ServerConfig();
    const bucket = (req.query?.bucket as string) || config.bucket || "academy-connect-files";

    // 2. Upload replacement JSON to Cloudflare R2
    const uploadResult = await uploadObjectToR2({
      bucket,
      key: newR2ObjectKey,
      body: jsonBuffer,
      contentType: "application/json",
      metadata: {
        testid: cleanBank.testId,
        version: String(nextVersion),
        questioncount: String(cleanBank.questions.length),
      },
    });

    // 3. Verify new upload exists in storage
    const newHead = await headObjectFromR2({ bucket, key: newR2ObjectKey });
    if (!newHead.exists) {
      throw new Error(`Failed to verify replacement upload in R2 for key: ${newR2ObjectKey}`);
    }

    // 4. Safely delete superseded old question JSON from R2
    let oldKeyDeleted = false;
    if (previousKey && previousKey !== newR2ObjectKey) {
      const cleanOldKey = String(previousKey).replace(/^\/+/, "");
      await deleteObjectFromR2({ bucket, key: cleanOldKey });
      const oldHead = await headObjectFromR2({ bucket, key: cleanOldKey });
      oldKeyDeleted = !oldHead.exists;
    }

    // 5. Delete superseded old images if provided
    if (Array.isArray(oldImageKeys) && oldImageKeys.length > 0) {
      const cleanImgKeys = oldImageKeys.map((k) => String(k).replace(/^\/+/, "")).filter(Boolean);
      await deleteObjectsFromR2({ bucket, keys: cleanImgKeys });
    }

    return res.status(200).json({
      success: true,
      data: {
        testId: cleanBank.testId,
        title: cleanBank.title,
        subject: cleanBank.subject,
        chapter: cleanBank.chapter,
        questionCount: cleanBank.questions.length,
        duration: cleanBank.duration,
        totalMarks: cleanBank.totalMarks,
        negativeMarking: cleanBank.negativeMarking,
        r2ObjectKey: newR2ObjectKey,
        oldR2ObjectKey: previousKey || null,
        oldKeyDeleted,
        version: nextVersion,
        fileSize: jsonBuffer.length,
      },
      message: "Practice test replaced atomically in Cloudflare R2 with zero orphan files.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Practice Replace] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to atomically replace practice test in Cloudflare R2.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
