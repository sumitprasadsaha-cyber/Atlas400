import { costTracker } from "../../src/services/ai/costTracker";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed. Use GET." });

  try {
    const summary = costTracker.getMetrics();
    return res.status(200).json({ success: true, metrics: summary });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to get AI metrics." });
  }
}
