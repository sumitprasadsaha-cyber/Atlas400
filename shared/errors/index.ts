export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR", details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed", details?: unknown) {
    super(message, 401, "AUTHENTICATION_ERROR", details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "You do not have permission to perform this action", details?: unknown) {
    super(message, 403, "AUTHORIZATION_ERROR", details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class StorageError extends AppError {
  constructor(message: string = "Storage operation failed", details?: unknown) {
    super(message, 502, "STORAGE_ERROR", details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string = "Configuration validation failed", details?: unknown) {
    super(message, 500, "CONFIGURATION_ERROR", details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = "Database operation failed", details?: unknown) {
    super(message, 500, "DATABASE_ERROR", details);
  }
}
