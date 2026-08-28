import handler from "../storage.js";

export const runtime = "nodejs";

export default async function r2UploadHandler(req: any, res: any) {
  if (!req.query) req.query = {};
  req.query.action = "upload";
  return handler(req, res);
}
