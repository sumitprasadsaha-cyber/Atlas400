import handler from "../storage";

export const runtime = "nodejs";

export default async function r2DownloadHandler(req: any, res: any) {
  if (!req.query) req.query = {};
  req.query.action = "download";
  return handler(req, res);
}
