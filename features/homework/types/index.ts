export interface HomeworkItem {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  dueDate: string;
  assignedBy: string;
  createdAt: string;
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "completed";
  remarks?: string;
}
