import { ApiResponse, R2HealthResponse } from "../../../shared/types/api.types";
import { logger } from "../../../shared/utils/logger";

export const r2HealthService = {
  /**
   * Fetches R2 health and connectivity status from the server endpoint.
   */
  async checkHealth(): Promise<R2HealthResponse> {
    try {
      const response = await fetch("/api/r2/health", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`R2 Health Check HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        storage: data.storage || "Cloudflare R2",
        status: data.status || (data.configured ? "ok" : "unconfigured"),
        bucketConnectivity: Boolean(data.bucketConnectivity ?? data.configured),
        configurationStatus: data.configurationStatus || (data.configured ? "valid" : "incomplete"),
        environmentValidation: data.environmentValidation || {
          hasAccountId: false,
          hasAccessKey: false,
          hasSecretKey: false,
          hasBucket: true,
          hasEndpoint: false,
          hasPublicUrl: false,
        },
        bucket: data.bucket || "academy-connect-files",
        timestamp: data.timestamp || new Date().toISOString(),
      };
    } catch (error) {
      logger.error("R2 Health Check request failed", error);
      return {
        storage: "Cloudflare R2",
        status: "degraded",
        bucketConnectivity: false,
        configurationStatus: "incomplete",
        environmentValidation: {
          hasAccountId: false,
          hasAccessKey: false,
          hasSecretKey: false,
          hasBucket: false,
          hasEndpoint: false,
          hasPublicUrl: false,
        },
        bucket: "unknown",
        timestamp: new Date().toISOString(),
      };
    }
  },
};
