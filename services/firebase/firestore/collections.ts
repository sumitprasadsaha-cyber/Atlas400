/**
 * Centralized Firestore collection names.
 * Primary Phase 2 collections: USERS, STUDENTS, ADMINS, SETTINGS, AUDIT_LOGS, APP_CONFIG.
 * Future phase collections defined for architectural extensibility.
 */
export const COLLECTIONS = {
  // Phase 2 & 3 Core Collections
  USERS: "users",
  STUDENTS: "students",
  ADMINS: "admins",
  SETTINGS: "settings",
  AUDIT_LOGS: "audit_logs",
  APP_CONFIG: "app_config",
  NOTES: "notes",

  // Phase 4 Collections
  PRACTICE_TESTS: "practice_tests",
  STUDENT_ATTEMPTS: "student_attempts",
  TEST_ATTEMPTS: "student_attempts", // alias for backward compatibility
  PRACTICE_RESULTS: "practice_results",
  PRACTICE_ASSIGNMENTS: "practice_assignments",

  // Future Phase Collections
  TEACHERS: "teachers",
  CLASSES: "classes",
  SUBJECTS: "subjects",
  NOTES_METADATA: "notes_metadata",
  ATTENDANCE: "attendance",
  FEES: "fees",
  HOMEWORK: "homework",
  NOTIFICATIONS: "notifications",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS] | (string & {});
