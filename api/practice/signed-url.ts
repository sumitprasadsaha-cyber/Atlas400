import { generateR2SignedUrl, getR2ServerConfig, headObjectFromR2 } from "../_lib/r2Server";

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
    const { key, r2ObjectKey, storageKey, operation, contentType, expiresIn } = req.body || {};
    const targetKey = r2ObjectKey || storageKey || key;

    if (!targetKey) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'r2ObjectKey' or 'key' parameter." } });
    }

    const cleanKey = String(targetKey).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = (req.body?.bucket || config.bucket || "academy-connect-files").trim();
    const expirySeconds = Number(expiresIn) || 300; // Strict 5 minutes (300 seconds)

    // For getObject, verify object exists
    if (operation !== "putObject") {
      const head = await headObjectFromR2({ bucket, key: cleanKey });
      if (!head.exists) {
        return res.status(404).json({ success: false, error: { message: `Question bank or asset not found in storage: ${cleanKey}` } });
      }
    }

    const signedUrl = await generateR2SignedUrl({
      bucket,
      key: cleanKey,
      expiresIn: expirySeconds,
      operation: operation === "putObject" ? "putObject" : "getObject",
      contentType: contentType || (cleanKey.endsWith(".json") ? "application/json" : undefined),
    });

    return res.status(200).json({
      success: true,
      data: {
        signedUrl,
        r2ObjectKey: cleanKey,
        bucket,
        expiresIn: expirySeconds,
        operation: operation || "getObject",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Practice Signed URL] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to generate signed URL for practice test.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
