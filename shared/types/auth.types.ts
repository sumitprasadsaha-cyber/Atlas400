export type UserRole = "admin" | "teacher" | "student";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  photoURL?: string | null;
  studentId?: string;
  teacherId?: string;
  classId?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  studentName?: string;
  studentPasscode?: string;
  classId?: string;
}

export interface SessionData {
  user: AuthUser;
  expiresAt: number;
  token?: string;
}
