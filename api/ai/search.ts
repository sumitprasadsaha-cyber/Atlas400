import { handleSemanticSearch } from "../../src/services/ai/search";

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
    const { query, items, classFilter, subjectFilter, userId, userRole } = body || {};

    if (!query) {
      return res.status(400).json({ error: "Missing query parameter" });
    }

    const result = await handleSemanticSearch({
      query,
      items: items || [],
      classFilter,
      subjectFilter,
      userId,
      userRole,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("Error performing AI semantic search:", err);
    return res.status(500).json({ error: err.message || "Failed to perform semantic search." });
  }
}
