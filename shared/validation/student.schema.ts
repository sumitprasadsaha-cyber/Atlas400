import { ValidationResult } from "./auth.schema";

export function validateStudentData(data: {
  name?: string;
  classGrade?: string;
  phone?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || !data.name.trim()) {
    errors.name = "Student name is required";
  }

  if (!data.classGrade || !data.classGrade.trim()) {
    errors.classGrade = "Class/Grade is required";
  }

  if (data.phone && !/^\+?[0-9]{10,13}$/.test(data.phone.trim().replace(/[\s-]/g, ""))) {
    errors.phone = "Invalid phone number format";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
