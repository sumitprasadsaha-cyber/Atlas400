import { generateR2SignedUrl, getR2ServerConfig, headObjectFromR2, getObjectFromR2 } from "../_lib/r2Server";

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
    const key = (req.query?.key as string) || (req.query?.r2ObjectKey as string) || (req.query?.storageKey as string);
    if (!key) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'key' or 'r2ObjectKey' query parameter." } });
    }

    const cleanKey = String(key).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = ((req.query?.bucket as string) || config.bucket || "academy-connect-files").trim();
    const expiresIn = Number(req.query?.expiresIn) || 300; // Strict 5 minutes (300 seconds)

    // Verify object exists in storage
    const head = await headObjectFromR2({ bucket, key: cleanKey });
    if (!head.exists) {
      return res.status(404).json({ success: false, error: { message: `Question bank or asset not found in storage: ${cleanKey}` } });
    }

    // Generate signed URL (5 minutes expiry)
    const signedUrl = await generateR2SignedUrl({
      bucket,
      key: cleanKey,
      expiresIn,
      operation: "getObject",
      contentType: head.contentType,
    });

    const isDirectFetch = req.query?.direct === "true" || req.query?.fetchJson === "true";

    if (isDirectFetch && cleanKey.endsWith(".json")) {
      const obj = await getObjectFromR2({ bucket, key: cleanKey });
      if (obj.body) {
        res.setHeader("Content-Type", "application/json");
        return obj.body.pipe(res);
      }
    }

    const shouldRedirect = req.query?.redirect === "true" || req.headers?.accept?.includes("text/html");
    if (shouldRedirect) {
      return res.redirect(302, signedUrl);
    }

    return res.status(200).json({
      success: true,
      data: {
        signedUrl,
        r2ObjectKey: cleanKey,
        bucket,
        expiresIn,
        contentType: head.contentType,
        contentLength: head.contentLength,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Practice Download] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to generate download URL for question bank.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
