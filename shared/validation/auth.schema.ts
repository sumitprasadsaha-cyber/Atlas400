export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateEmailLogin(email?: string, password?: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (!email || !email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "Invalid email format";
  }

  if (!password || password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateStudentLogin(studentName?: string, studentPasscode?: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (!studentName || !studentName.trim()) {
    errors.studentName = "Student name is required";
  }

  if (!studentPasscode || !studentPasscode.trim()) {
    errors.studentPasscode = "Passcode is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
