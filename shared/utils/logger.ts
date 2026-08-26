type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  module?: string;
  action?: string;
  [key: string]: unknown;
}

const IS_PROD = typeof process !== "undefined" && process.env?.NODE_ENV === "production";

function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  const sensitiveKeys = ["password", "token", "secret", "apiKey", "accessKey", "secretAccessKey", "passcode"];
  
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.module}] ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    if (!IS_PROD) {
      console.debug(this.formatMessage("debug", message, context), context ? sanitizeData(context) : "");
    }
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("info", message, context), context ? sanitizeData(context) : "");
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context), context ? sanitizeData(context) : "");
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error ? { message: error.message, stack: IS_PROD ? undefined : error.stack } : error;
    console.error(this.formatMessage("error", message, context), {
      error: errorDetails,
      context: context ? sanitizeData(context) : undefined,
    });
  }
}

export function createLogger(module: string): Logger {
  return new Logger(module);
}

export const logger = new Logger("App");
