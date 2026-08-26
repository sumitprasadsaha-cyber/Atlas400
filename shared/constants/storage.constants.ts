export const STORAGE_KEYS = {
  AUTH_TOKEN: "atlas_auth_token",
  USER_SESSION: "atlas_user_session",
  STUDENT_SESSION: "atlas_student_session",
  THEME: "atlas_theme_mode",
  ACTIVE_TAB: "atlas_active_tab",
  LAST_SYNC: "atlas_last_sync_timestamp",
} as const;

export const R2_CONFIG = {
  DEFAULT_BUCKET: "academy-connect-files",
  DEFAULT_SIGNED_URL_EXPIRY_SECONDS: 600, // 10 minutes
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  ALLOWED_DOCUMENT_TYPES: ["application/pdf"],
  ALLOWED_IMAGE_TYPES: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
} as const;
