export type StudentServiceStatus = "active" | "paused" | "ended";

export interface StudentParentInfo {
  fatherName?: string;
  motherName?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
}

export interface StudentAcademicInfo {
  classGrade: string;
  schoolName?: string;
  batch?: string;
  enrolledSubjects: string[];
}

export interface Student {
  id: string;
  name: string;
  rollNumber?: string;
  passcode?: string;
  serviceStatus: StudentServiceStatus;
  avatarUrl?: string;
  storageKey?: string;
  academic: StudentAcademicInfo;
  parent: StudentParentInfo;
  createdAt: string;
  updatedAt: string;
}
