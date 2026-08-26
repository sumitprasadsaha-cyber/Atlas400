import { UserRole } from "./auth.types";

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.admin_login"
  | "auth.password_reset"
  | "user.role_update"
  | "user.profile_update"
  | "admin.permission_change"
  | "storage.operation"
  | "storage.verify"
  | "note.upload_initiated"
  | "note.deleted"
  | "practice_test.created"
  | "system.config_updated"
  | "system.settings_updated";

export type AuditStatus = "success" | "failure" | "warning";

export type AuditResource =
  | "users"
  | "students"
  | "admins"
  | "settings"
  | "app_config"
  | "audit_logs"
  | "storage"
  | string;

export interface AuditLog {
  id?: string;
  timestamp: string;
  userId: string;
  role: UserRole | "system" | "anonymous";
  action: AuditAction | string;
  resource: AuditResource;
  status: AuditStatus;
  metadata?: Record<string, unknown>;
}
