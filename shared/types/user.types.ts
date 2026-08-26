import { Permission, UserRole } from "./auth.types";

/**
 * Represents a document in the `users` Firestore collection.
 */
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLogin: string;
  isActive: boolean;
  photoURL: string | null;
  studentId?: string;
}

/**
 * Represents guardian contact details for a student.
 */
export interface StudentGuardian {
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  relation?: string;
}

/**
 * Represents a document in the `students` Firestore collection.
 * Contains only student information without note/test/upload domain payload.
 */
export interface StudentDoc {
  studentId: string;
  fullName: string;
  batch: string;
  phone: string;
  email: string;
  guardian: StudentGuardian;
  profilePhoto: string | null;
  status: "active" | "inactive";
  serviceStatus: "active" | "paused" | "ended";
  joinedOn: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a document in the `admins` Firestore collection.
 */
export interface AdminDoc {
  uid: string;
  name: string;
  email: string;
  permissions: Permission[] | string[];
  createdAt: string;
  updatedAt: string;
}
