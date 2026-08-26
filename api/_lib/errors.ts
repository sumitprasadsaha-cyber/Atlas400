export class HttpError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: any) {
    super(400, message, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string = "Unauthorized access.") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string = "Forbidden action.") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = "Resource not found.") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class StorageError extends HttpError {
  constructor(message: string, details?: any) {
    super(500, message, details);
    this.name = "StorageError";
  }
}
