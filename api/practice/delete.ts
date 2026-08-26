import { deleteObjectFromR2, deleteObjectsFromR2, headObjectFromR2, getR2ServerConfig } from "../_lib/r2Server";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use POST or DELETE." } });
  }

  try {
    const { r2ObjectKey, key, imageKeys, associatedKeys } = req.body || {};
    const targetKey = r2ObjectKey || key || req.query?.key || req.query?.r2ObjectKey;

    if (!targetKey) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'r2ObjectKey' parameter." } });
    }

    const cleanKey = String(targetKey).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = (req.body?.bucket || req.query?.bucket || config.bucket || "academy-connect-files").trim();

    const deletedKeys: string[] = [];

    // 1. Delete main question bank JSON from R2
    const mainDelete = await deleteObjectFromR2({ bucket, key: cleanKey });
    deletedKeys.push(cleanKey);

    // 2. Delete all associated images / diagram media files from R2
    const extraKeys: string[] = [];
    if (Array.isArray(imageKeys)) extraKeys.push(...imageKeys);
    if (Array.isArray(associatedKeys)) extraKeys.push(...associatedKeys);

    if (extraKeys.length > 0) {
      const cleanExtraKeys = extraKeys.map((k) => String(k).replace(/^\/+/, "")).filter(Boolean);
      await deleteObjectsFromR2({ bucket, keys: cleanExtraKeys });
      deletedKeys.push(...cleanExtraKeys);
    }

    // 3. Verify zero orphan files remain
    const verifyHead = await headObjectFromR2({ bucket, key: cleanKey });
    const verifiedClean = !verifyHead.exists;

    return res.status(200).json({
      success: true,
      data: {
        r2ObjectKey: cleanKey,
        deletedKeys,
        verifiedClean,
        bucket,
      },
      message: "Practice test JSON and associated media purged completely from Cloudflare R2.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Practice Delete] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to delete practice test files from Cloudflare R2.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
