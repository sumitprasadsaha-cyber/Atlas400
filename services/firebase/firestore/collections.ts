export const COLLECTIONS = {
  USERS: "users",
  STUDENTS: "students",
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
  SETTINGS: "settings",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
