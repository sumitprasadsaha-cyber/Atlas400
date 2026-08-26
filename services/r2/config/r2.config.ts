export interface ClientR2Config {
  defaultBucket: string;
  signedUrlExpirySeconds: number;
}

export function getClientR2Config(): ClientR2Config {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  return {
    defaultBucket: env.VITE_R2_BUCKET || "academy-connect-files",
    signedUrlExpirySeconds: 600,
  };
}
