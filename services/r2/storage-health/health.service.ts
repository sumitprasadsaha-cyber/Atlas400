import { StorageHealthResult, ApiResponse } from "../../../shared/types/api.types";
import { logger } from "../../../shared/utils/logger";

export const r2HealthService = {
  async checkStorageHealth(): Promise<StorageHealthResult> {
    try {
      const response = await fetch("/api/r2/health");
      const resJson: ApiResponse<StorageHealthResult> = await response.json();

      if (!response.ok || !resJson.success) {
        return {
          status: "error",
          configured: false,
          bucket: "unknown",
          storage: "Cloudflare R2",
          timestamp: new Date().toISOString(),
        };
      }

      return resJson.data;
    } catch (error) {
      logger.error("R2 health check failed", error);
      return {
        status: "error",
        configured: false,
        bucket: "unknown",
        storage: "Cloudflare R2",
        timestamp: new Date().toISOString(),
      };
    }
  },
};
