import { APP_VERSION } from "../shared/constants/app.constants";

export const runtime = "nodejs";

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const deployment = process.env.NODE_ENV || "production";
  const timestamp = new Date().toISOString();

  return res.status(200).json({
    status: "healthy",
    version: `v${APP_VERSION}`,
    runtime: "nodejs",
    deployment,
    timestamp,
  });
}
