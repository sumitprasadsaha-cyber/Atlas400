import { ApiResponse } from "../../../shared/types/api.types";
import { logger } from "../../../shared/utils/logger";
import { getClientR2Config } from "../config/r2.config";

export interface R2DeleteResult {
  bucket: string;
  storageKey: string;
  r2ObjectKey: string;
  deleted: boolean;
}

export const r2DeleteService = {
  async deleteFile(storageKey: string, bucket?: string): Promise<R2DeleteResult> {
    try {
      const config = getClientR2Config();
      const targetBucket = bucket || config.defaultBucket;

      logger.info("Requesting R2 file deletion", { storageKey, bucket: targetBucket });

      const response = await fetch("/api/r2/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storageKey,
          bucket: targetBucket,
        }),
      });

      const resJson: ApiResponse<R2DeleteResult> = await response.json();

      if (!response.ok || !resJson.success) {
        const errorMsg = "error" in resJson && resJson.error ? resJson.error.message : `HTTP ${response.status}`;
        throw new Error(`Delete failed: ${errorMsg}`);
      }

      logger.info("R2 file deleted successfully", { storageKey });
      return resJson.data;
    } catch (error) {
      logger.error("R2 file deletion error", error, { storageKey });
      throw error;
    }
  },
};
