import handler from "../storage";

export const runtime = "nodejs";

export default async function r2VerifyHandler(req: any, res: any) {
  if (!req.query) req.query = {};
  req.query.action = "verify";
  return handler(req, res);
}
