import { R2_CONFIG } from "../constants/storage.constants";
import { ValidationResult } from "./auth.schema";

export function validateFileUpload(file: {
  size: number;
  type: string;
  name: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!file) {
    errors.file = "No file selected";
    return { isValid: false, errors };
  }

  if (file.size === 0) {
    errors.file = "File cannot be empty";
  }

  if (file.size > R2_CONFIG.MAX_FILE_SIZE_BYTES) {
    errors.file = `File exceeds maximum allowed size of 50MB (${Math.round(file.size / (1024 * 1024))}MB)`;
  }

  const allowedTypes: string[] = [
    ...R2_CONFIG.ALLOWED_DOCUMENT_TYPES,
    ...R2_CONFIG.ALLOWED_IMAGE_TYPES,
  ];

  if (!allowedTypes.includes(file.type.toLowerCase()) && !file.type.startsWith("image/")) {
    errors.file = `Unsupported file type: ${file.type || "unknown"}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
