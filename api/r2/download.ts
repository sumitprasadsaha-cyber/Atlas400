import { getObjectFromR2, headObjectFromR2, getR2ServerConfig } from "../_lib/r2Server";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, Accept");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, ETag, Content-Disposition");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const bucket = req.query?.bucket as string | undefined;
  const key = req.query?.key as string | undefined;

  if (!key) {
    if (req.method === "HEAD") return res.status(400).end();
    return res.status(400).send("Missing required 'key' query parameter.");
  }

  const cleanKey = key.replace(/^\/+/, "");
  const config = getR2ServerConfig();
  const actualBucket = bucket || config.bucket || "academy-connect-files";

  if (req.method === "HEAD") {
    try {
      const head = await headObjectFromR2({ bucket: actualBucket, key: cleanKey });
      if (!head.exists) {
        return res.status(404).end();
      }

      let contentType = (req.query?.mimeType as string) || head.contentType || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      if (head.etag) res.setHeader("ETag", head.etag);
      if (head.contentLength) res.setHeader("Content-Length", head.contentLength);
      return res.status(200).end();
    } catch {
      return res.status(404).end();
    }
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed. Use GET or HEAD.");
  }

  try {
    const range = req.headers?.range;
    const obj = await getObjectFromR2({ bucket: actualBucket, key: cleanKey, range });

    if (!obj.body) {
      return res.status(404).send("File not found in Cloudflare R2.");
    }

    let contentType = (req.query?.mimeType as string) || obj.contentType || "application/octet-stream";
    if (contentType === "application/octet-stream" || !contentType) {
      if (cleanKey.toLowerCase().endsWith(".pdf")) contentType = "application/pdf";
      else if (cleanKey.toLowerCase().endsWith(".png")) contentType = "image/png";
      else if (cleanKey.toLowerCase().endsWith(".jpg") || cleanKey.toLowerCase().endsWith(".jpeg")) contentType = "image/jpeg";
      else if (cleanKey.toLowerCase().endsWith(".webp")) contentType = "image/webp";
      else if (cleanKey.toLowerCase().endsWith(".gif")) contentType = "image/gif";
      else if (cleanKey.toLowerCase().endsWith(".svg")) contentType = "image/svg+xml";
      else if (cleanKey.toLowerCase().endsWith(".json")) contentType = "application/json";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    if (obj.etag) res.setHeader("ETag", obj.etag);
    if (obj.contentRange) {
      res.status(206);
      res.setHeader("Content-Range", obj.contentRange);
    }
    if (obj.contentLength) res.setHeader("Content-Length", obj.contentLength);

    if (req.query?.download === "true" || req.query?.filename) {
      const downloadFilename = (req.query?.filename as string) || cleanKey.split("/").pop() || "download";
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
    }

    obj.body.pipe(res);
  } catch (err: any) {
    console.error("[Vercel R2] Download error:", err);
    if (err.name === "NoSuchKey" || err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).send("File not found in Cloudflare R2.");
    }
    return res.status(500).send(`Cloudflare R2 Download Error: ${err.message || err}`);
  }
}
