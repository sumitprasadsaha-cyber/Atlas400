import { ValidationError, StorageError } from "../../../shared/errors";
import { getR2ServerConfig, isR2Configured } from "../../../api/_lib/r2Server";

export interface R2ValidationStatus {
  isConfigured: boolean;
  isValid: boolean;
  bucket: string;
  missingFields: string[];
  endpoint: string;
}

export const r2ValidationService = {
  /**
   * Validates Cloudflare R2 server environment variables and credentials.
   */
  validateConfig(): R2ValidationStatus {
    const config = getR2ServerConfig();
    const missing: string[] = [];

    if (!config.accountId && !config.endpoint) missing.push("R2_ACCOUNT_ID or R2_ENDPOINT");
    if (!config.accessKeyId) missing.push("R2_ACCESS_KEY_ID");
    if (!config.secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
    if (!config.bucket) missing.push("R2_BUCKET");

    return {
      isConfigured: isR2Configured(),
      isValid: missing.length === 0,
      bucket: config.bucket,
      missingFields: missing,
      endpoint: config.endpoint || "",
    };
  },

  /**
   * Validates target bucket name conformity.
   */
  validateBucketName(bucketName?: string): string {
    const target = (bucketName || getR2ServerConfig().bucket || "academy-connect-files").trim();
    if (!target) {
      throw new ValidationError("Bucket name cannot be empty.");
    }
    if (!/^[a-zA-Z0-9.\-_]{3,63}$/.test(target)) {
      throw new ValidationError(`Invalid bucket name format: ${target}`);
    }
    return target;
  },
};
