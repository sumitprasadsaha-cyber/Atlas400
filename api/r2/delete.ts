import { deleteObjectFromR2, headObjectFromR2, getR2ServerConfig } from "../_lib/r2Server";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use POST or DELETE." } });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    body = body || {};

    const storageKey =
      body.storageKey ||
      body.r2ObjectKey ||
      body.key ||
      body.path ||
      req.query?.storageKey ||
      req.query?.r2ObjectKey ||
      req.query?.key ||
      req.query?.path;

    if (!storageKey) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'r2ObjectKey' or 'storageKey' parameter." } });
    }

    const cleanKey = String(storageKey).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = (body.bucket || (req.query?.bucket as string) || config.bucket || "academy-connect-files").trim();

    // 1. Delete object from R2
    const deleteResult = await deleteObjectFromR2({
      bucket,
      key: cleanKey,
    });

    // 2. Verify deletion
    const verify = await headObjectFromR2({ bucket, key: cleanKey });
    const isDeleted = !verify.exists;

    return res.status(200).json({
      success: true,
      data: {
        bucket: deleteResult.bucket,
        storageKey: cleanKey,
        r2ObjectKey: cleanKey,
        deleted: isDeleted,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Serverless R2] Error deleting object:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to delete Cloudflare R2 object.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
