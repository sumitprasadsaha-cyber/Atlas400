import { uploadObjectToR2, getR2ServerConfig, headObjectFromR2 } from "../_lib/r2Server";
import { validateQuestionBank } from "../../shared/validation/practice.validator";

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
    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (err: any) {
        return res.status(400).json({ success: false, error: { message: "Invalid JSON format: " + err.message } });
      }
    }

    const { subject, chapter, testId, title, questions, duration, negativeMarking, batch, description } = payload || {};

    const validation = validateQuestionBank(payload, {
      testId,
      title,
      subject,
      chapter,
      batch,
      duration,
    });

    if (!validation.isValid || !validation.cleanQuestionBank) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Validation failed for practice test question bank.",
          details: validation.errors,
          warnings: validation.warnings,
        },
      });
    }

    const cleanBank = validation.cleanQuestionBank;
    const normSubject = (cleanBank.subject || "general").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const normChapter = (cleanBank.chapter || "ch1").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const cleanTestId = cleanBank.testId.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Standard R2 object key path: practice-tests/{subject}/{chapter}/{uuid}.json
    const r2ObjectKey = `practice-tests/${normSubject}/${normChapter}/${cleanTestId}.json`;
    const jsonString = JSON.stringify(cleanBank, null, 2);
    const jsonBuffer = Buffer.from(jsonString, "utf-8");

    const config = getR2ServerConfig();
    const bucket = (req.query?.bucket as string) || config.bucket || "academy-connect-files";

    // Upload JSON document to Cloudflare R2
    const uploadResult = await uploadObjectToR2({
      bucket,
      key: r2ObjectKey,
      body: jsonBuffer,
      contentType: "application/json",
      metadata: {
        testid: cleanBank.testId,
        title: encodeURIComponent(cleanBank.title),
        subject: encodeURIComponent(cleanBank.subject),
        chapter: encodeURIComponent(cleanBank.chapter),
        questioncount: String(cleanBank.questions.length),
        version: String(cleanBank.version),
      },
    });

    // Verify upload exists in storage
    const head = await headObjectFromR2({ bucket, key: r2ObjectKey });
    if (!head.exists) {
      throw new Error("Failed to verify question bank upload in Cloudflare R2.");
    }

    const downloadUrl = `/api/practice/download?key=${encodeURIComponent(r2ObjectKey)}`;

    return res.status(200).json({
      success: true,
      data: {
        testId: cleanBank.testId,
        title: cleanBank.title,
        subject: cleanBank.subject,
        chapter: cleanBank.chapter,
        batch: cleanBank.batch,
        description: cleanBank.description,
        questionCount: cleanBank.questions.length,
        duration: cleanBank.duration,
        totalMarks: cleanBank.totalMarks,
        negativeMarking: cleanBank.negativeMarking,
        r2ObjectKey,
        bucket: uploadResult.bucket,
        fileSize: jsonBuffer.length,
        version: cleanBank.version,
        url: downloadUrl,
        warnings: validation.warnings,
      },
      message: "Practice test question bank uploaded and validated successfully.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Practice Upload] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to upload practice test question bank.",
      },
    });
  }
}
