import handler from "../storage.js";

export const runtime = "nodejs";

export default async function r2SignedUrlHandler(req: any, res: any) {
  if (!req.query) req.query = {};
  req.query.action = "signed-url";
  return handler(req, res);
}
