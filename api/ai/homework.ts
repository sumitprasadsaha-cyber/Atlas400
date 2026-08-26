import { handleHomeworkGeneration } from "../../src/services/ai/homework";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }
    const { classGrade, subject, chapterName, topicName, difficulty, learningObjectives, estimatedDurationMinutes, userId, userRole } = body || {};

    if (!classGrade || !subject || !chapterName) {
      return res.status(400).json({ error: "Missing required curriculum fields (classGrade, subject, chapterName)" });
    }

    const result = await handleHomeworkGeneration({
      classGrade,
      subject,
      chapterName,
      topicName,
      difficulty,
      learningObjectives,
      estimatedDurationMinutes,
      userId,
      userRole,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("Error generating homework with AI:", err);
    return res.status(500).json({ error: err.message || "Failed to generate homework." });
  }
}
