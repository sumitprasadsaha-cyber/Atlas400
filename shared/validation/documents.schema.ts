import { UserDoc, StudentDoc, AdminDoc } from "../types/user.types";
import { SettingsDoc, AppConfigDoc } from "../types/config.types";
import { AuditLog } from "../types/audit.types";
import { ValidationError } from "../errors";

export function validateEmail(email?: unknown): string {
  if (typeof email !== "string" || !email.trim()) {
    throw new ValidationError("Email is required and must be a non-empty string.");
  }
  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new ValidationError(`Invalid email format: ${trimmed}`);
  }
  return trimmed;
}

export function validatePhone(phone?: unknown): string {
  if (typeof phone !== "string" || !phone.trim()) {
    throw new ValidationError("Phone number is required and must be a string.");
  }
  const trimmed = phone.trim();
  const phoneRegex = /^[+]?[0-9\s\-()]{7,20}$/;
  if (!phoneRegex.test(trimmed)) {
    throw new ValidationError(`Invalid phone format: ${trimmed}`);
  }
  return trimmed;
}

export function validateUID(uid?: unknown): string {
  if (typeof uid !== "string" || !uid.trim()) {
    throw new ValidationError("UID is required and must be a non-empty string.");
  }
  const trimmed = uid.trim();
  if (trimmed.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
    throw new ValidationError(`Invalid UID format: ${trimmed}`);
  }
  return trimmed;
}

export function validateUserDoc(data: Partial<UserDoc>): UserDoc {
  if (!data || typeof data !== "object") {
    throw new ValidationError("User document data must be an object.");
  }

  const uid = validateUID(data.uid);
  const email = validateEmail(data.email);
  const displayName = typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim() : email.split("@")[0];
  const role = data.role === "admin" || data.role === "student" ? data.role : "student";
  const now = new Date().toISOString();

  return {
    uid,
    email,
    displayName,
    role,
    createdAt: data.createdAt || now,
    updatedAt: now,
    lastLogin: data.lastLogin || now,
    isActive: typeof data.isActive === "boolean" ? data.isActive : true,
    photoURL: data.photoURL || null,
    studentId: data.studentId || undefined,
  };
}

export function validateStudentDoc(data: Partial<StudentDoc>): StudentDoc {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Student document data must be an object.");
  }

  const studentId = validateUID(data.studentId || (data as any).id);
  const fullName = typeof data.fullName === "string" && data.fullName.trim()
    ? data.fullName.trim()
    : typeof (data as any).name === "string"
    ? (data as any).name.trim()
    : "";

  if (!fullName) {
    throw new ValidationError("Student fullName is required.");
  }

  const email = validateEmail(data.email);
  const phone = validatePhone(data.phone);
  const batch = typeof data.batch === "string" ? data.batch.trim() : (data as any).classGrade || "General";
  const status = data.status === "active" || data.status === "inactive" ? data.status : "active";
  const serviceStatus =
    data.serviceStatus === "active" || data.serviceStatus === "paused" || data.serviceStatus === "ended"
      ? data.serviceStatus
      : "active";
  const now = new Date().toISOString();

  return {
    studentId,
    fullName,
    batch,
    phone,
    email,
    guardian: data.guardian || {
      fatherName: (data as any).parentPhone ? "Guardian" : undefined,
      phone: (data as any).parentPhone || undefined,
    },
    profilePhoto: data.profilePhoto || null,
    status,
    serviceStatus,
    joinedOn: data.joinedOn || now,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

export function validateAdminDoc(data: Partial<AdminDoc>): AdminDoc {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Admin document data must be an object.");
  }

  const uid = validateUID(data.uid);
  const email = validateEmail(data.email);
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : email.split("@")[0];
  const permissions = Array.isArray(data.permissions) ? data.permissions : ["admin.all"];
  const now = new Date().toISOString();

  return {
    uid,
    name,
    email,
    permissions,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

export function validateSettingsDoc(data: Partial<SettingsDoc>): SettingsDoc {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Settings document data must be an object.");
  }

  const appVersion = typeof data.appVersion === "string" && data.appVersion.trim() ? data.appVersion.trim() : "5.0.0";
  const maintenanceMode = Boolean(data.maintenanceMode);
  const minimumSupportedVersion =
    typeof data.minimumSupportedVersion === "string" ? data.minimumSupportedVersion.trim() : "5.0.0";

  const contactEmail = data.contactInformation?.email ? validateEmail(data.contactInformation.email) : "support@atlas.academy";

  return {
    appVersion,
    maintenanceMode,
    minimumSupportedVersion,
    contactInformation: {
      email: contactEmail,
      phone: data.contactInformation?.phone,
      supportUrl: data.contactInformation?.supportUrl,
      address: data.contactInformation?.address,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: data.updatedBy,
  };
}

export function validateAppConfigDoc(data: Partial<AppConfigDoc>): AppConfigDoc {
  if (!data || typeof data !== "object") {
    throw new ValidationError("AppConfig document data must be an object.");
  }

  const storageBackend = data.storageBackend === "r2" || data.storageBackend === "local" || data.storageBackend === "firebase"
    ? data.storageBackend
    : "r2";
  const aiProvider = "gemini";
  const maxUploadSize = typeof data.maxUploadSize === "number" && data.maxUploadSize > 0 ? data.maxUploadSize : 52428800; // 50MB
  const allowedFileTypes = Array.isArray(data.allowedFileTypes) && data.allowedFileTypes.length > 0
    ? data.allowedFileTypes
    : ["application/pdf", "image/png", "image/jpeg", "image/webp"];

  const featureFlags = {
    enableGoogleAuth: Boolean(data.featureFlags?.enableGoogleAuth),
    enableAIAssistant: data.featureFlags?.enableAIAssistant !== false,
    enableAuditLogs: data.featureFlags?.enableAuditLogs !== false,
    enableMaintenanceNotification: Boolean(data.featureFlags?.enableMaintenanceNotification),
    ...data.featureFlags,
  };

  return {
    storageBackend,
    aiProvider,
    maxUploadSize,
    allowedFileTypes,
    featureFlags,
    updatedAt: new Date().toISOString(),
    updatedBy: data.updatedBy,
  };
}

export function validateAuditLog(data: Partial<AuditLog>): AuditLog {
  if (!data || typeof data !== "object") {
    throw new ValidationError("AuditLog data must be an object.");
  }

  if (!data.userId) {
    throw new ValidationError("AuditLog requires userId.");
  }
  if (!data.action) {
    throw new ValidationError("AuditLog requires action.");
  }
  if (!data.resource) {
    throw new ValidationError("AuditLog requires resource.");
  }

  return {
    timestamp: data.timestamp || new Date().toISOString(),
    userId: String(data.userId),
    role: data.role || "anonymous",
    action: String(data.action),
    resource: String(data.resource),
    status: data.status === "failure" ? "failure" : data.status === "warning" ? "warning" : "success",
    metadata: data.metadata || {},
  };
}
