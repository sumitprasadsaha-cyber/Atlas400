export interface AppSettings {
  appName: string;
  instituteName: string;
  contactEmail: string;
  contactPhone: string;
  academicYear: string;
  storageProvider: "Cloudflare R2";
  databaseProvider: "Google Cloud Firestore";
  version: string;
}
