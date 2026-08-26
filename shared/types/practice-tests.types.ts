export type QuestionDifficulty = "easy" | "medium" | "hard";
export type PracticeTestStatus = "published" | "draft" | "archived" | "deleted";
export type AttemptStatus = "in_progress" | "submitted" | "abandoned";
export type PassStatus = "passed" | "failed";

export interface PracticeTestQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number | string; // 0-based index or matching text
  explanation?: string;
  difficulty?: QuestionDifficulty;
  marks: number;
  negativeMarks?: number;
  image?: string; // Cloudflare R2 object key or URL
  diagram?: string;
  reference?: string;
  hint?: string;
  tags?: string[];
}

export interface PracticeTestQuestionBank {
  testId: string;
  title: string;
  subject: string;
  chapter: string;
  batch?: string;
  description?: string;
  duration: number; // in minutes
  totalMarks: number;
  negativeMarking?: number;
  questions: PracticeTestQuestion[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type QuestionBank = PracticeTestQuestionBank;

export interface PracticeTest {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  chapterNo?: number;
  topicName?: string;
  classGrade?: string;
  batch?: string;
  classId?: string;
  description?: string;
  r2ObjectKey: string; // e.g. "practice-tests/physics/ch1/uuid.json"
  questionCount: number;
  duration: number; // in minutes
  durationMinutes?: number; // alias
  totalMarks: number;
  passingMarks?: number;
  negativeMarking: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: PracticeTestStatus;
  version: number;
  visibility: boolean;
  tags: string[];
  imageKeys?: string[];
  questions?: PracticeTestQuestion[];
}

export interface StudentTestAttempt {
  attemptId: string;
  id?: string; // alias for backwards compatibility
  studentId: string;
  studentName?: string;
  practiceTestId: string;
  testId?: string; // alias
  testTitle?: string;
  subject?: string;
  chapter?: string;
  r2ObjectKey?: string;
  startedAt: string;
  submittedAt?: string;
  completedAt?: string; // alias
  timeTaken: number; // in seconds
  timeSpentSeconds?: number; // alias
  answers: Record<string, number | string>; // questionId -> answer index or text
  selectedAnswers?: Record<string, number>; // alias
  score: number;
  totalMarks: number;
  percentage: number;
  passed?: boolean;
  passStatus?: PassStatus;
  correct: number;
  wrong: number;
  unanswered: number;
  status: AttemptStatus;
  currentQuestionIndex?: number;
  remainingSeconds?: number;
  autoSavedAt?: string;
}

export interface PracticeResult {
  id: string;
  attemptId: string;
  studentId: string;
  studentName?: string;
  practiceTestId: string;
  testTitle: string;
  subject: string;
  chapter: string;
  finalScore: number;
  totalMarks: number;
  percentage: number;
  rank?: number;
  percentile?: number;
  passStatus: PassStatus;
  completionTime: number; // in seconds
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  breakdownByDifficulty?: {
    easy: { total: number; correct: number; score: number };
    medium: { total: number; correct: number; score: number };
    hard: { total: number; correct: number; score: number };
  };
  generatedAt: string;
}

export interface PracticeAssignment {
  id: string;
  practiceTestId: string;
  testTitle: string;
  subject: string;
  chapter: string;
  assignedBatches: string[];
  assignedStudents: string[];
  dueDate: string;
  visibility: boolean;
  assignedBy: string;
  assignedAt: string;
  status: "active" | "expired" | "cancelled";
}

export interface PracticeAnalytics {
  testId: string;
  title: string;
  totalAttempts: number;
  uniqueStudents: number;
  completionRate: number; // percentage
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  averageDurationSeconds: number;
  difficultyStats: {
    easy: { count: number; avgAccuracy: number };
    medium: { count: number; avgAccuracy: number };
    hard: { count: number; avgAccuracy: number };
  };
  frequentlyMissedQuestions: Array<{
    questionId: string;
    questionNumber: number;
    questionText: string;
    missedPercentage: number;
  }>;
}
