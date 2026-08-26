export type UserRole = "admin" | "student";

export type Permission =
  | "admin.all"
  | "users.read"
  | "users.write"
  | "students.read"
  | "students.write"
  | "settings.read"
  | "settings.write"
  | "audit.read"
  | "storage.verify"
  | "student.self.read"
  | "student.self.write";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  photoURL?: string | null;
  isActive: boolean;
  studentId?: string;
  permissions?: Permission[];
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface SessionData {
  user: AuthUser;
  role: UserRole;
  permissions: Permission[];
  expiresAt: number;
  token?: string;
  authenticatedAt: string;
}

export interface TokenValidationResult {
  valid: boolean;
  uid?: string;
  email?: string;
  method: "firebase-id-token" | "session-cookie" | "header-bearer";
  expiresAt?: number;
  error?: string;
}
