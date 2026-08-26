import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { AppSettings } from "../types";
import { APP_CONFIG } from "../../../shared/constants";

const DEFAULT_SETTINGS: AppSettings = {
  appName: APP_CONFIG.NAME,
  instituteName: APP_CONFIG.ORGANIZATION,
  contactEmail: "admin@academyconnect.com",
  contactPhone: "+91 98765 43210",
  academicYear: "2025-2026",
  storageProvider: "Cloudflare R2",
  databaseProvider: "Google Cloud Firestore",
  version: APP_CONFIG.VERSION,
};

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    const data = await firestoreService.getDocument<AppSettings>(COLLECTIONS.SETTINGS, "general");
    return data || DEFAULT_SETTINGS;
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    await firestoreService.setDocument(COLLECTIONS.SETTINGS, "general", settings);
  },
};
