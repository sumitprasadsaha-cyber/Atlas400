export const APP_ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  STUDENTS: "/students",
  STUDENT_DETAILS: "/students/:id",
  TEACHERS: "/teachers",
  ATTENDANCE: "/attendance",
  FEES: "/fees",
  NOTES: "/notes",
  PRACTICE_TESTS: "/practice-tests",
  HOMEWORK: "/homework",
  NOTIFICATIONS: "/notifications",
  SETTINGS: "/settings",
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;
