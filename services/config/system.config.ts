import { validateEnvironmentConfig, EnvironmentValidationResult } from "../../shared/validation/config.schema";
import { APP_VERSION } from "../../shared/constants/app.constants";
import { logger } from "../../shared/utils/logger";

export interface SystemConfig {
  version: string;
  environment: string;
  isProduction: boolean;
  validation: EnvironmentValidationResult;
}

class SystemConfigManager {
  private config: SystemConfig;

  constructor() {
    const isProduction = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
    const environment = isProduction ? "production" : "development";
    const validation = validateEnvironmentConfig();

    this.config = {
      version: APP_VERSION,
      environment,
      isProduction,
      validation,
    };

    if (!validation.isValid) {
      logger.error("System configuration validation warnings/errors:", validation.errors);
    } else {
      logger.info(`System initialized in ${environment} mode (Atlas v${APP_VERSION})`);
    }
  }

  getConfig(): SystemConfig {
    return this.config;
  }

  isR2Ready(): boolean {
    return this.config.validation.details.r2.isConfigured;
  }

  isFirebaseReady(): boolean {
    return this.config.validation.details.firebase.isConfigured;
  }

  isGeminiReady(): boolean {
    return this.config.validation.details.gemini.isConfigured;
  }

  getVersion(): string {
    return this.config.version;
  }
}

export const systemConfig = new SystemConfigManager();
