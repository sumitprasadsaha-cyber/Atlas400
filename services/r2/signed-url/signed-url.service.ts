import { R2SignedUrlResult, ApiResponse } from "../../../shared/types/api.types";
import { logger } from "../../../shared/utils/logger";
import { getClientR2Config } from "../config/r2.config";

export const r2SignedUrlService = {
  async getSignedUrl(
    storageKey: string,
    bucket?: string,
    expiresIn: number = 600
  ): Promise<R2SignedUrlResult> {
    try {
      const config = getClientR2Config();
      const targetBucket = bucket || config.defaultBucket;

      logger.debug("Requesting temporary signed URL", { storageKey, bucket: targetBucket, expiresIn });

      const response = await fetch("/api/r2/signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storageKey,
          bucket: targetBucket,
          expiresIn,
        }),
      });

      const resJson: ApiResponse<R2SignedUrlResult> = await response.json();

      if (!response.ok || !resJson.success) {
        const errorMsg = "error" in resJson && resJson.error ? resJson.error.message : `HTTP ${response.status}`;
        throw new Error(`Failed to get signed URL: ${errorMsg}`);
      }

      return resJson.data;
    } catch (error) {
      logger.error("Error fetching signed URL", error, { storageKey, bucket });
      throw error;
    }
  },
};
