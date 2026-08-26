export interface ContactInformation {
  email: string;
  phone?: string;
  supportUrl?: string;
  address?: string;
}

export interface SettingsDoc {
  appVersion: string;
  maintenanceMode: boolean;
  minimumSupportedVersion: string;
  contactInformation: ContactInformation;
  updatedAt?: string;
  updatedBy?: string;
}

export interface FeatureFlags {
  enableGoogleAuth: boolean;
  enableAIAssistant: boolean;
  enableAuditLogs: boolean;
  enableMaintenanceNotification: boolean;
  [key: string]: boolean;
}

export interface AppConfigDoc {
  storageBackend: "r2" | "local" | "firebase";
  aiProvider: "gemini";
  maxUploadSize: number; // in bytes (e.g. 52428800 = 50MB)
  allowedFileTypes: string[];
  featureFlags: FeatureFlags;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SystemEnvironment {
  nodeEnv: string;
  appVersion: string;
  hasFirebaseConfig: boolean;
  hasGeminiKey: boolean;
  hasR2Config: boolean;
}
