export interface ClientR2Config {
  defaultBucket: string;
  signedUrlExpirySeconds: number;
  maxUploadSizeBytes: number;
  allowedMimeTypes: string[];
}

export function getClientR2Config(): ClientR2Config {
  const env = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}) as Record<string, string | undefined>;
  return {
    defaultBucket: env.VITE_R2_BUCKET || "academy-connect-files",
    signedUrlExpirySeconds: 600,
    maxUploadSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/json",
      "text/plain",
    ],
  };
}
