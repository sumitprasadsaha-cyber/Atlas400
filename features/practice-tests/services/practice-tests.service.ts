import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { PracticeTest, StudentTestAttempt } from "../../../shared/types/practice-tests.types";
import { where, orderBy, Unsubscribe } from "firebase/firestore";
import { logger } from "../../../shared/utils/logger";

export const practiceTestsService = {
  async getTestsBySubject(classId: string, subjectId: string): Promise<PracticeTest[]> {
    return firestoreService.getCollection<PracticeTest>(COLLECTIONS.PRACTICE_TESTS, [
      where("classId", "==", classId),
      where("subjectId", "==", subjectId),
      orderBy("createdAt", "desc"),
    ]);
  },

  async getTestById(testId: string): Promise<PracticeTest | null> {
    return firestoreService.getDocument<PracticeTest>(COLLECTIONS.PRACTICE_TESTS, testId);
  },

  async saveTest(test: PracticeTest): Promise<void> {
    await firestoreService.setDocument(COLLECTIONS.PRACTICE_TESTS, test.id, test);
  },

  async deleteTest(testId: string): Promise<void> {
    await firestoreService.deleteDocument(COLLECTIONS.PRACTICE_TESTS, testId);
  },

  async submitAttempt(attempt: StudentTestAttempt): Promise<void> {
    logger.info("Submitting student test attempt to Firestore", { testId: attempt.testId, studentId: attempt.studentId, score: attempt.score });
    await firestoreService.setDocument(COLLECTIONS.TEST_ATTEMPTS, attempt.id, attempt);
  },

  async getStudentAttempts(studentId: string): Promise<StudentTestAttempt[]> {
    return firestoreService.getCollection<StudentTestAttempt>(COLLECTIONS.TEST_ATTEMPTS, [
      where("studentId", "==", studentId),
      orderBy("completedAt", "desc"),
    ]);
  },

  subscribeToTests(classId: string, onUpdate: (tests: PracticeTest[]) => void): Unsubscribe {
    return firestoreService.subscribeToCollection<PracticeTest>(
      COLLECTIONS.PRACTICE_TESTS,
      [where("classId", "==", classId)],
      onUpdate
    );
  },
};
