import { generateR2SignedUrl, getR2ServerConfig } from "../_lib/r2Server";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use POST." } });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    body = body || {};

    const storageKey = body.storageKey || body.r2ObjectKey || body.key;
    if (!storageKey) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'storageKey' or 'r2ObjectKey' parameter." } });
    }

    const cleanKey = String(storageKey).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = (body.bucket || config.bucket || "academy-connect-files").trim();
    // Default expiration strictly 5 minutes (300 seconds)
    const expiresIn = Number(body.expiresIn) || 300;

    const signedUrl = await generateR2SignedUrl({
      bucket,
      key: cleanKey,
      expiresIn,
      operation: body.operation === "putObject" ? "putObject" : "getObject",
      contentType: body.contentType,
    });

    return res.status(200).json({
      success: true,
      data: {
        signedUrl,
        bucket,
        storageKey: cleanKey,
        r2ObjectKey: cleanKey,
        expiresIn,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Serverless R2] Error generating signed URL:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to generate Cloudflare R2 signed URL.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
