import { handleNoteAnalysis } from "../../src/services/ai/notes";

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
    const { textSnippet, originalFileName, suggestedSubject, suggestedGrade, userId } = body || {};

    if (!textSnippet) {
      return res.status(400).json({ error: "Missing textSnippet in request body" });
    }

    const result = await handleNoteAnalysis({
      textSnippet,
      originalFileName,
      suggestedSubject,
      suggestedGrade,
      userId,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("Error analyzing note with AI:", err);
    return res.status(500).json({ error: err.message || "Failed to analyze note." });
  }
}
