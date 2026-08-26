export interface PracticeTestQuestion {
  id: string;
  testId: string;
  questionNumber: number;
  text: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
  marks: number;
}

export interface PracticeTest {
  id: string;
  title: string;
  classId: string;
  subjectId: string;
  chapterId: string;
  topicId?: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  questions: PracticeTestQuestion[];
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentTestAttempt {
  id: string;
  testId: string;
  studentId: string;
  studentName?: string;
  selectedAnswers: Record<string, number>; // questionId -> optionIndex
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  timeSpentSeconds: number;
  completedAt: string;
}
