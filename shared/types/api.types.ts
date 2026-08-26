import { AuthUser, Permission, UserRole } from "./auth.types";

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthResponse {
  version: string;
  runtime: string;
  status: "healthy" | "degraded" | "maintenance";
  deployment: string;
  timestamp: string;
}

export interface R2HealthResponse {
  storage: string;
  status: "ok" | "degraded" | "unconfigured";
  bucketConnectivity: boolean;
  configurationStatus: "valid" | "incomplete";
  environmentValidation: {
    hasAccountId: boolean;
    hasAccessKey: boolean;
    hasSecretKey: boolean;
    hasBucket: boolean;
    hasEndpoint: boolean;
    hasPublicUrl: boolean;
  };
  bucket: string;
  timestamp: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
  role: UserRole | null;
  permissions: Permission[];
  tokenValidation: {
    valid: boolean;
    method: string;
    expiresAt?: number;
  };
  timestamp: string;
}

// AI Service API response types
export interface AiChatResult {
  reply?: string;
  response?: string;
  timestamp?: string;
}

export interface AiReportResult {
  markdown?: string;
  reportText?: string;
  timestamp?: string;
}

// R2 Service API response types
export interface R2SignedUrlResult {
  signedUrl: string;
  bucket: string;
  storageKey: string;
  expiresIn: number;
}

export interface R2UploadResult {
  bucket: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  originalFilename: string;
}
