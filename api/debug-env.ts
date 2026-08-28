import { handleOptions } from "./_lib/responses.js";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;

  const data = {
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_ENDPOINT: !!process.env.R2_ENDPOINT,
    R2_BUCKET: !!process.env.R2_BUCKET,
    R2_PUBLIC_URL: !!process.env.R2_PUBLIC_URL,
  };

  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(data);
}
