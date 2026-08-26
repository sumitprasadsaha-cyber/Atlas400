import { uploadObjectToR2, getR2ServerConfig } from "../_lib/r2Server";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  try {
    const bucket = (req.query?.bucket as string) || req.body?.bucket;
    const key = (req.query?.key as string) || req.body?.key;
    let contentType = (req.query?.mimeType as string) || req.headers?.["content-type"] || "application/octet-stream";

    if (!key) {
      return res.status(400).json({ error: "Missing required 'key' parameter." });
    }

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body && typeof req.body === "object" && req.body.base64) {
      buffer = Buffer.from(req.body.base64, "base64");
      if (req.body.mimeType) contentType = req.body.mimeType;
    } else if (typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        if (parsed.base64) {
          buffer = Buffer.from(parsed.base64, "base64");
          if (parsed.mimeType) contentType = parsed.mimeType;
        } else {
          buffer = Buffer.from(req.body, "utf-8");
        }
      } catch {
        buffer = Buffer.from(req.body, "utf-8");
      }
    } else {
      return res.status(400).json({ error: "No upload body data received." });
    }

    const result = await uploadObjectToR2({
      bucket,
      key,
      body: buffer,
      contentType,
    });

    const serverConfig = getR2ServerConfig();
    const downloadUrl = `/api/r2/download?bucket=${encodeURIComponent(result.bucket)}&key=${encodeURIComponent(key)}`;
    const publicUrl = serverConfig.publicUrl
      ? `${serverConfig.publicUrl}/${key.replace(/^\/+/, "")}`
      : downloadUrl;

    return res.status(200).json({
      success: true,
      bucket: result.bucket,
      key: result.key,
      etag: result.etag,
      url: downloadUrl,
      publicUrl,
      size: buffer.length,
      mimeType: contentType,
    });
  } catch (err: any) {
    console.error("[Vercel R2] Upload error:", err);
    return res.status(500).json({
      error: err.message || "Failed to upload file to Cloudflare R2.",
    });
  }
}
