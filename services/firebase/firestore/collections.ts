/**
 * Centralized Firestore collection names.
 * Primary Phase 2 collections: USERS, STUDENTS, ADMINS, SETTINGS, AUDIT_LOGS, APP_CONFIG.
 * Future phase collections defined for architectural extensibility.
 */
export const COLLECTIONS = {
  // Phase 2 Core Collections
  USERS: "users",
  STUDENTS: "students",
  ADMINS: "admins",
  SETTINGS: "settings",
  AUDIT_LOGS: "audit_logs",
  APP_CONFIG: "app_config",

  // Future Phase Collections
  TEACHERS: "teachers",
  CLASSES: "classes",
  SUBJECTS: "subjects",
  NOTES_METADATA: "notes_metadata",
  PRACTICE_TESTS: "practice_tests",
  TEST_ATTEMPTS: "test_attempts",
  ATTENDANCE: "attendance",
  FEES: "fees",
  HOMEWORK: "homework",
  NOTIFICATIONS: "notifications",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS] | (string & {});
