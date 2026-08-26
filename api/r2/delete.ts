import { deleteObjectFromR2, getR2ServerConfig } from "../_lib/r2Server";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed. Use POST or DELETE." });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    body = body || {};

    const storageKey = body.storageKey || body.key || req.query?.storageKey || req.query?.key;
    if (!storageKey) {
      return res.status(400).json({ error: "Missing required 'storageKey' parameter." });
    }

    const cleanKey = String(storageKey).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = (body.bucket || (req.query?.bucket as string) || config.bucket || "academy-connect-files").trim();

    await deleteObjectFromR2({
      bucket,
      key: cleanKey,
    });

    return res.status(200).json({
      success: true,
      bucket,
      storageKey: cleanKey,
    });
  } catch (err: any) {
    console.error("[Vercel R2] Error deleting object:", err);
    return res.status(500).json({
      error: err.message || "Failed to delete Cloudflare R2 object.",
    });
  }
}
