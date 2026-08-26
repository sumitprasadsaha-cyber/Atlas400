import { moderationService } from "../../src/services/ai/moderation";

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
    const { text, userId } = body || {};
    const result = await moderationService.checkContent(text || "", userId);
    return res.status(200).json({ success: true, moderation: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Moderation check failed." });
  }
}
