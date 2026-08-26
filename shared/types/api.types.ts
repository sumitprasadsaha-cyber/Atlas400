export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface R2UploadResult {
  bucket: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  originalFilename: string;
}

export interface R2SignedUrlResult {
  signedUrl: string;
  bucket: string;
  storageKey: string;
  expiresIn: number;
}

export interface StorageHealthResult {
  status: "ok" | "degraded" | "error";
  configured: boolean;
  bucket: string;
  storage: string;
  timestamp: string;
}

export interface AiChatResult {
  response: string;
  usage?: {
    totalTokens?: number;
  };
}

export interface AiReportResult {
  reportText: string;
  generatedAt: string;
}
