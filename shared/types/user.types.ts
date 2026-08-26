import { UserRole } from "./auth.types";

export interface BaseUserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProfile extends BaseUserProfile {
  role: "admin";
  permissions: string[];
}

export interface TeacherProfile extends BaseUserProfile {
  role: "teacher";
  assignedClasses: string[];
  assignedSubjects: string[];
  phone?: string;
}
