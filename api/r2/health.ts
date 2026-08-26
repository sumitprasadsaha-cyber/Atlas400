import { getR2ServerConfig, isR2Configured } from "../_lib/r2Server";

export const runtime = "nodejs";

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const config = getR2ServerConfig();
  const configured = isR2Configured();
  return res.status(200).json({
    status: "ok",
    configured,
    bucket: config.bucket,
    storage: "Cloudflare R2",
    timestamp: new Date().toISOString(),
  });
}
