import { handleStudentChat, handleAdminChat } from "../../src/services/ai/chat";

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
    const { role, query, studentId, studentName, classGrade, enrolledSubjects, notesContext, recentTestTopic, action, dataContext, history } = body || {};

    if (!query) {
      return res.status(400).json({ error: "Missing query in request body" });
    }

    if (role === "student") {
      const result = await handleStudentChat({
        query,
        studentId,
        studentName,
        classGrade,
        enrolledSubjects,
        notesContext,
        recentTestTopic,
        history,
      });
      return res.status(200).json({ success: true, reply: result.reply, model: result.model, remainingDailyQuota: result.remainingDailyQuota });
    } else {
      const result = await handleAdminChat({
        query,
        action,
        dataContext,
        history,
      });
      return res.status(200).json({ success: true, reply: result.reply, model: result.model, remainingDailyQuota: result.remainingDailyQuota });
    }
  } catch (err: any) {
    console.error("Error in AI Chat endpoint:", err);
    return res.status(500).json({
      error: err.message || "AI Chat failed.",
    });
  }
}
