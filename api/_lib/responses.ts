import { HttpError } from "./errors";

/**
 * Sets comprehensive CORS and caching headers on the outgoing response.
 */
export function setCorsHeaders(res: any, methods: string = "GET, POST, PUT, DELETE, OPTIONS, HEAD"): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization, X-Requested-With, Accept");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, ETag, Content-Disposition");
}

/**
 * Handles HTTP OPTIONS preflight requests.
 */
export function handleOptions(req: any, res: any, methods: string = "GET, POST, PUT, DELETE, OPTIONS, HEAD"): boolean {
  if (req.method === "OPTIONS") {
    setCorsHeaders(res, methods);
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Sends a standard success JSON response.
 */
export function sendSuccess(res: any, data: any = {}, statusCode: number = 200): void {
  setCorsHeaders(res);
  if (typeof data === "object" && data !== null && data.success === undefined) {
    res.status(statusCode).json({ success: true, ...data });
  } else {
    res.status(statusCode).json(data);
  }
}

/**
 * Sends a structured error JSON response.
 */
export function sendError(res: any, error: any, defaultMessage: string = "Internal server error", defaultCode?: string): void {
  setCorsHeaders(res);
  const stack = error?.stack || new Error().stack;
  console.error("[API Error Handler]", {
    message: error?.message || error,
    code: error?.code || defaultCode,
    stack: stack,
    details: error?.details,
  });

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code || defaultCode || "HTTP_ERROR",
      details: error.details,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }

  const statusCode = error?.statusCode || error?.status || 500;
  const message = error?.message || defaultMessage;
  const code = error?.code || defaultCode || (statusCode === 404 ? "OBJECT_NOT_FOUND" : statusCode === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR");

  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    details: error?.details,
    stack: process.env.NODE_ENV !== "production" ? stack : undefined,
  });
}

