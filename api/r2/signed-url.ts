import { generateR2SignedUrl, headObjectFromR2, getR2ServerConfig } from "../../src/lib/r2Server";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, ETag, Content-Disposition");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    body = body || {};

    const { bucket, key, expiresIn, operation, contentType } = body;
    if (!key) {
      return res.status(400).json({ error: "Missing required 'key' parameter." });
    }

    const cleanKey = String(key).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const actualBucket = (bucket || config.bucket || "academy-connect-files").trim();

    let headStatus = 200;
    let headContentType = contentType || "application/octet-stream";
    let headContentLength = 0;
    let exists = true;
    let effectiveKey = cleanKey;

    try {
      const headCheck = await headObjectFromR2({ bucket: actualBucket, key: cleanKey });
      exists = headCheck.exists;
      headStatus = headCheck.exists ? 200 : 404;
      if (headCheck.contentType) headContentType = headCheck.contentType;
      if (headCheck.contentLength) headContentLength = headCheck.contentLength;
      if (headCheck.resolvedKey) effectiveKey = headCheck.resolvedKey;
    } catch (headErr: any) {
      console.warn("[Vercel R2] Head verification warning:", headErr?.message || headErr);
    }

    const signedUrl = await generateR2SignedUrl({
      bucket: actualBucket,
      key: effectiveKey,
      expiresIn: Number(expiresIn) || 3600,
      operation: operation === "putObject" ? "putObject" : "getObject",
      contentType: headContentType,
    });

    return res.status(200).json({
      success: true,
      signedUrl,
      exists,
      status: headStatus,
      contentType: headContentType,
      contentLength: headContentLength,
      bucket: actualBucket,
      key: effectiveKey,
    });
  } catch (err: any) {
    console.error("[Vercel R2] Error generating signed URL:", err);
    return res.status(500).json({
      error: err.message || "Failed to generate Cloudflare R2 signed URL.",
    });
  }
}
