import { generateR2SignedUrl, getR2ServerConfig, headObjectFromR2 } from "../_lib/r2Server";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use GET." } });
  }

  try {
    const key =
      (req.query?.key as string) ||
      (req.query?.storageKey as string) ||
      (req.query?.r2ObjectKey as string) ||
      (req.query?.storagePath as string);

    if (!key) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'storageKey' or 'key' parameter." } });
    }

    const cleanKey = String(key).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = ((req.query?.bucket as string) || config.bucket || "academy-connect-files").trim();
    const expiresIn = Number(req.query?.expiresIn) || 300; // Strict 5 minutes (300 seconds)

    // Verify object exists in storage
    const head = await headObjectFromR2({ bucket, key: cleanKey });
    if (!head.exists) {
      return res.status(404).json({ success: false, error: { message: `File not found in storage: ${cleanKey}` } });
    }

    // Generate temporary signed URL (5 minutes expiry)
    const signedUrl = await generateR2SignedUrl({
      bucket,
      key: cleanKey,
      expiresIn,
      operation: "getObject",
      contentType: head.contentType,
    });

    const isDirectBrowserNavigation =
      req.headers?.accept?.includes("text/html") ||
      req.query?.redirect === "true" ||
      req.query?.action === "open";

    if (isDirectBrowserNavigation) {
      return res.redirect(302, signedUrl);
    }

    return res.status(200).json({
      success: true,
      data: {
        signedUrl,
        r2ObjectKey: cleanKey,
        storageKey: cleanKey,
        bucket,
        expiresIn,
        contentType: head.contentType,
        contentLength: head.contentLength,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Serverless R2] Download signed URL error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to generate download URL for document.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
