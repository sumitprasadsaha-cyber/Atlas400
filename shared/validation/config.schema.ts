import { ConfigurationError } from "../errors";

export interface EnvironmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    firebase: { isConfigured: boolean; missing: string[] };
    r2: { isConfigured: boolean; missing: string[] };
    gemini: { isConfigured: boolean };
    appVersion: string;
  };
}

export function validateEnvironmentConfig(): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const env = (typeof process !== "undefined" && process.env ? process.env : {}) as Record<string, string | undefined>;

  // Firebase Validation
  const firebaseMissing: string[] = [];
  if (!env.VITE_FIREBASE_API_KEY && !env.FIREBASE_API_KEY) firebaseMissing.push("VITE_FIREBASE_API_KEY");
  if (!env.VITE_FIREBASE_PROJECT_ID && !env.FIREBASE_PROJECT_ID) firebaseMissing.push("VITE_FIREBASE_PROJECT_ID");
  if (!env.VITE_FIREBASE_AUTH_DOMAIN && !env.FIREBASE_AUTH_DOMAIN) firebaseMissing.push("VITE_FIREBASE_AUTH_DOMAIN");

  const isFirebaseConfigured = firebaseMissing.length === 0;
  if (!isFirebaseConfigured) {
    warnings.push(`Firebase configuration is incomplete: missing ${firebaseMissing.join(", ")}`);
  }

  // Cloudflare R2 Validation
  const r2Missing: string[] = [];
  const accountId = env.R2_ACCOUNT_ID || env.VITE_R2_ACCOUNT_ID;
  const accessKey = env.R2_ACCESS_KEY_ID || env.VITE_R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY || env.VITE_R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET || env.VITE_R2_BUCKET || "academy-connect-files";

  if (!accountId && !env.R2_ENDPOINT) r2Missing.push("R2_ACCOUNT_ID / R2_ENDPOINT");
  if (!accessKey) r2Missing.push("R2_ACCESS_KEY_ID");
  if (!secretKey) r2Missing.push("R2_SECRET_ACCESS_KEY");

  const isR2Configured = r2Missing.length === 0;
  if (!isR2Configured) {
    warnings.push(`Cloudflare R2 is in fallback mode: missing ${r2Missing.join(", ")}`);
  }

  // Gemini AI Validation
  const hasGeminiKey = Boolean(env.GEMINI_API_KEY);
  if (!hasGeminiKey) {
    warnings.push("GEMINI_API_KEY environment variable is not set.");
  }

  const appVersion = "5.0.0";

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    details: {
      firebase: { isConfigured: isFirebaseConfigured, missing: firebaseMissing },
      r2: { isConfigured: isR2Configured, missing: r2Missing },
      gemini: { isConfigured: hasGeminiKey },
      appVersion,
    },
  };
}

export function assertValidEnvironment(): void {
  const result = validateEnvironmentConfig();
  if (!result.isValid) {
    throw new ConfigurationError(`Environment configuration error: ${result.errors.join("; ")}`);
  }
}
