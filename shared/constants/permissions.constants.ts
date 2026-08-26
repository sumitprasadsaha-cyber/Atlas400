import { Permission, UserRole } from "../types/auth.types";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "admin.all",
    "users.read",
    "users.write",
    "students.read",
    "students.write",
    "settings.read",
    "settings.write",
    "audit.read",
    "storage.verify",
  ],
  student: [
    "student.self.read",
    "student.self.write",
  ],
};

export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = ROLE_PERMISSIONS.admin;
export const DEFAULT_STUDENT_PERMISSIONS: Permission[] = ROLE_PERMISSIONS.student;
