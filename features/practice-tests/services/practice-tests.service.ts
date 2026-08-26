import { firestoreService, COLLECTIONS, auditService } from "../../../services/firebase";
import {
  PracticeTest,
  PracticeTestQuestionBank,
  StudentTestAttempt,
  PracticeResult,
  PracticeAssignment,
  PracticeAnalytics,
  PracticeTestStatus,
} from "../../../shared/types/practice-tests.types";
import { where, orderBy, Unsubscribe, QueryConstraint } from "firebase/firestore";
import { logger } from "../../../shared/utils/logger";

export interface PracticeTestFilterOptions {
  subject?: string;
  chapter?: string;
  batch?: string;
  status?: PracticeTestStatus | "all";
  visibilityOnly?: boolean;
  searchQuery?: string;
}

export const practiceTestsService = {
  /**
   * 1. Create a new Practice Test: Uploads Question Bank to R2, saves metadata to Firestore, logs audit
   */
  async createTest(
    questionBank: PracticeTestQuestionBank,
    options?: {
      createdBy?: string;
      visibility?: boolean;
      status?: PracticeTestStatus;
      tags?: string[];
      classId?: string;
    }
  ): Promise<{ test: PracticeTest; r2Key: string }> {
    logger.info("Creating practice test", { title: questionBank.title, subject: questionBank.subject });

    // 1. Upload Question Bank to Cloudflare R2 via API
    const uploadRes = await fetch("/api/practice/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questionBank),
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.success) {
      throw new Error(uploadData.error?.message || "Failed to upload question bank to Cloudflare R2.");
    }

    const { r2ObjectKey } = uploadData.data;
    const now = new Date().toISOString();
    const testId = questionBank.testId || `test_${Date.now()}`;

    const metadata: PracticeTest = {
      id: testId,
      title: questionBank.title,
      subject: questionBank.subject,
      chapter: questionBank.chapter,
      batch: questionBank.batch || "All Batches",
      classId: options?.classId || "Class 10",
      description: questionBank.description || "",
      r2ObjectKey,
      questionCount: questionBank.questions.length,
      duration: questionBank.duration || 30,
      totalMarks: questionBank.totalMarks,
      negativeMarking: questionBank.negativeMarking || 0.25,
      createdBy: options?.createdBy || "Admin",
      createdAt: now,
      updatedAt: now,
      status: options?.status || "published",
      version: 1,
      visibility: options?.visibility !== undefined ? options.visibility : true,
      tags: options?.tags || [questionBank.subject, questionBank.chapter].filter(Boolean),
    };

    // 2. Write metadata document to Firestore
    await firestoreService.setDocument(COLLECTIONS.PRACTICE_TESTS, testId, metadata);

    // 3. Log audit event
    await auditService.logAction(
      options?.createdBy || "admin",
      "PRACTICE_TEST_CREATED",
      "practice_tests",
      testId,
      { title: metadata.title, questionCount: metadata.questionCount, r2ObjectKey }
    );

    return { test: metadata, r2Key: r2ObjectKey };
  },

  /**
   * 2. Replace Question Bank: Atomically uploads new JSON to R2, updates Firestore metadata, purges old JSON
   */
  async replaceQuestionBank(
    testId: string,
    newQuestionBank: PracticeTestQuestionBank,
    user: { id: string; name?: string; role?: string }
  ): Promise<{ test: PracticeTest; newR2Key: string }> {
    logger.info("Replacing practice test question bank", { testId, title: newQuestionBank.title });

    const currentTest = await this.getTestById(testId);
    if (!currentTest) {
      throw new Error(`Practice test '${testId}' not found.`);
    }

    // Call atomic replace endpoint
    const replaceRes = await fetch("/api/practice/replace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldR2ObjectKey: currentTest.r2ObjectKey,
        newQuestionBank,
        version: currentTest.version,
      }),
    });

    const replaceData = await replaceRes.json();
    if (!replaceRes.ok || !replaceData.success) {
      throw new Error(replaceData.error?.message || "Failed to atomically replace test in Cloudflare R2.");
    }

    const { r2ObjectKey: newR2Key, version: newVersion } = replaceData.data;
    const now = new Date().toISOString();

    const updatedMetadata: Partial<PracticeTest> = {
      title: newQuestionBank.title || currentTest.title,
      subject: newQuestionBank.subject || currentTest.subject,
      chapter: newQuestionBank.chapter || currentTest.chapter,
      questionCount: newQuestionBank.questions.length,
      duration: newQuestionBank.duration || currentTest.duration,
      totalMarks: newQuestionBank.totalMarks,
      negativeMarking: newQuestionBank.negativeMarking ?? currentTest.negativeMarking,
      r2ObjectKey: newR2Key,
      version: newVersion,
      updatedAt: now,
    };

    // Update Firestore document
    await firestoreService.updateDocument(COLLECTIONS.PRACTICE_TESTS, testId, updatedMetadata);

    const mergedTest = { ...currentTest, ...updatedMetadata };

    // Audit log
    await auditService.logAction(
      user.id || "admin",
      "PRACTICE_TEST_REPLACED",
      "practice_tests",
      testId,
      { oldR2Key: currentTest.r2ObjectKey, newR2Key, version: newVersion }
    );

    return { test: mergedTest, newR2Key };
  },

  /**
   * 3. Delete Practice Test: Deletes R2 JSON, associated media, and Firestore metadata. Zero orphans.
   */
  async deleteTest(testId: string, user: { id: string; name?: string; role?: string }): Promise<void> {
    logger.info("Deleting practice test", { testId });

    const currentTest = await this.getTestById(testId);
    if (!currentTest) {
      logger.warn("Test already deleted or does not exist", { testId });
      return;
    }

    // 1. Delete all R2 assets (JSON and image keys)
    const delRes = await fetch("/api/practice/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        r2ObjectKey: currentTest.r2ObjectKey,
        imageKeys: currentTest.imageKeys || [],
      }),
    });

    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      logger.error("Warning: Failed to delete R2 files, proceeding with Firestore deletion", err);
    }

    // 2. Delete Firestore document
    await firestoreService.deleteDocument(COLLECTIONS.PRACTICE_TESTS, testId);

    // 3. Audit log
    await auditService.logAction(
      user.id || "admin",
      "PRACTICE_TEST_DELETED",
      "practice_tests",
      testId,
      { title: currentTest.title, r2ObjectKey: currentTest.r2ObjectKey }
    );
  },

  /**
   * 4. Update test visibility & metadata
   */
  async updateTest(testId: string, patch: Partial<PracticeTest>, updatedBy: string = "admin"): Promise<void> {
    const now = new Date().toISOString();
    await firestoreService.updateDocument(COLLECTIONS.PRACTICE_TESTS, testId, {
      ...patch,
      updatedAt: now,
    });
    await auditService.logAction(updatedBy, "PRACTICE_TEST_UPDATED", "practice_tests", testId, patch);
  },

  /**
   * 5. Get Test by ID
   */
  async getTestById(testId: string): Promise<PracticeTest | null> {
    return firestoreService.getDocument<PracticeTest>(COLLECTIONS.PRACTICE_TESTS, testId);
  },

  /**
   * 6. Query Practice Tests with filters
   */
  async getTests(filters?: PracticeTestFilterOptions): Promise<PracticeTest[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.subject && filters.subject !== "all") {
      constraints.push(where("subject", "==", filters.subject));
    }
    if (filters?.status && filters.status !== "all") {
      constraints.push(where("status", "==", filters.status));
    }
    if (filters?.visibilityOnly) {
      constraints.push(where("visibility", "==", true));
    }

    constraints.push(orderBy("createdAt", "desc"));

    let tests = await firestoreService.getCollection<PracticeTest>(COLLECTIONS.PRACTICE_TESTS, constraints);

    if (filters?.chapter && filters.chapter !== "all") {
      tests = tests.filter((t) => t.chapter.toLowerCase() === filters.chapter!.toLowerCase());
    }
    if (filters?.batch && filters.batch !== "all") {
      tests = tests.filter((t) => !t.batch || t.batch === "All Batches" || t.batch === filters.batch);
    }
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      tests = tests.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.chapter.toLowerCase().includes(q) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }

    return tests;
  },

  /**
   * 7. Realtime subscription to Practice Tests
   */
  subscribeToTests(filters: PracticeTestFilterOptions | undefined, onUpdate: (tests: PracticeTest[]) => void): Unsubscribe {
    const constraints: QueryConstraint[] = [];
    if (filters?.subject && filters.subject !== "all") {
      constraints.push(where("subject", "==", filters.subject));
    }
    if (filters?.status && filters.status !== "all") {
      constraints.push(where("status", "==", filters.status));
    }
    if (filters?.visibilityOnly) {
      constraints.push(where("visibility", "==", true));
    }

    return firestoreService.subscribeToCollection<PracticeTest>(
      COLLECTIONS.PRACTICE_TESTS,
      constraints,
      (tests) => {
        let filtered = tests;
        if (filters?.chapter && filters.chapter !== "all") {
          filtered = filtered.filter((t) => t.chapter.toLowerCase() === filters.chapter!.toLowerCase());
        }
        if (filters?.batch && filters.batch !== "all") {
          filtered = filtered.filter((t) => !t.batch || t.batch === "All Batches" || t.batch === filters.batch);
        }
        if (filters?.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.subject.toLowerCase().includes(q) ||
              t.chapter.toLowerCase().includes(q)
          );
        }
        onUpdate(filtered);
      }
    );
  },

  /**
   * 8. Fetch question bank JSON securely from R2 via signed URL
   */
  async fetchQuestionBank(r2ObjectKey: string): Promise<PracticeTestQuestionBank> {
    if (!r2ObjectKey) throw new Error("r2ObjectKey is required to fetch question bank.");

    // Direct JSON fetch from download endpoint
    const url = `/api/practice/download?key=${encodeURIComponent(r2ObjectKey)}&fetchJson=true`;
    const res = await fetch(url);
    if (res.ok) {
      return res.json();
    }

    // Fallback: get signed URL then fetch from R2
    const signedRes = await fetch("/api/practice/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ r2ObjectKey, expiresIn: 300 }),
    });

    const signedData = await signedRes.json();
    if (!signedRes.ok || !signedData.data?.signedUrl) {
      throw new Error(signedData.error?.message || "Failed to obtain signed URL for question bank.");
    }

    const r2Fetch = await fetch(signedData.data.signedUrl);
    if (!r2Fetch.ok) {
      throw new Error(`Failed to load questions from Cloudflare R2 (${r2Fetch.status}).`);
    }
    return r2Fetch.json();
  },

  /**
   * 9. Start a student test attempt (initializes Firestore document)
   */
  async startAttempt(
    studentId: string,
    practiceTestId: string,
    test: PracticeTest,
    studentName?: string
  ): Promise<StudentTestAttempt> {
    const attemptId = `att_${studentId}_${practiceTestId}_${Date.now()}`;
    const now = new Date().toISOString();

    const attempt: StudentTestAttempt = {
      attemptId,
      id: attemptId,
      studentId,
      studentName: studentName || "Student",
      practiceTestId,
      testId: practiceTestId,
      testTitle: test.title,
      subject: test.subject,
      chapter: test.chapter,
      startedAt: now,
      timeTaken: 0,
      answers: {},
      score: 0,
      totalMarks: test.totalMarks,
      percentage: 0,
      correct: 0,
      wrong: 0,
      unanswered: test.questionCount,
      status: "in_progress",
      currentQuestionIndex: 0,
      remainingSeconds: test.duration * 60,
      autoSavedAt: now,
    };

    await firestoreService.setDocument(COLLECTIONS.STUDENT_ATTEMPTS, attemptId, attempt);
    return attempt;
  },

  /**
   * 10. Auto-save attempt progress (called periodically by student exam runner)
   */
  async autoSaveAttempt(
    attemptId: string,
    patch: {
      currentQuestionIndex?: number;
      remainingSeconds?: number;
      answers: Record<string, any>;
      timeTaken?: number;
    }
  ): Promise<void> {
    const now = new Date().toISOString();
    await firestoreService.updateDocument(COLLECTIONS.STUDENT_ATTEMPTS, attemptId, {
      ...patch,
      autoSavedAt: now,
    });
  },

  /**
   * 11. Submit test attempt: Evaluates answers server-side, writes result & attempt to Firestore
   */
  async submitAttempt(payload: {
    attemptId: string;
    studentId: string;
    studentName?: string;
    practiceTestId: string;
    r2ObjectKey: string;
    answers: Record<string, any>;
    timeTaken: number;
    startedAt?: string;
  }): Promise<{ attempt: StudentTestAttempt; result: PracticeResult; review: any[] }> {
    logger.info("Submitting practice test for evaluation", {
      studentId: payload.studentId,
      testId: payload.practiceTestId,
    });

    const res = await fetch("/api/practice/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || "Evaluation failed during submission.");
    }

    const { attempt, result, review } = data.data;

    // Save final evaluated attempt and result documents to Firestore
    await Promise.all([
      firestoreService.setDocument(COLLECTIONS.STUDENT_ATTEMPTS, attempt.attemptId, attempt),
      firestoreService.setDocument(COLLECTIONS.PRACTICE_RESULTS, result.id, result),
    ]);

    // Audit log
    await auditService.logAction(
      payload.studentId,
      "PRACTICE_TEST_SUBMITTED",
      "practice_results",
      result.id,
      {
        testId: payload.practiceTestId,
        score: result.finalScore,
        percentage: result.percentage,
        passStatus: result.passStatus,
      }
    );

    return { attempt, result, review };
  },

  /**
   * 12. Get student attempts with realtime updates
   */
  subscribeToStudentAttempts(studentId: string, onUpdate: (attempts: StudentTestAttempt[]) => void): Unsubscribe {
    return firestoreService.subscribeToCollection<StudentTestAttempt>(
      COLLECTIONS.STUDENT_ATTEMPTS,
      [where("studentId", "==", studentId)],
      (attempts) => {
        // Sort descending by startedAt
        const sorted = [...attempts].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        onUpdate(sorted);
      }
    );
  },

  async getStudentAttempts(studentId: string, testId?: string): Promise<StudentTestAttempt[]> {
    const constraints: QueryConstraint[] = [where("studentId", "==", studentId)];
    if (testId) {
      constraints.push(where("practiceTestId", "==", testId));
    }
    const attempts = await firestoreService.getCollection<StudentTestAttempt>(COLLECTIONS.STUDENT_ATTEMPTS, constraints);
    return attempts.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  },

  /**
   * 13. Get Test Results & Leaderboard
   */
  async getTestResults(testId: string): Promise<PracticeResult[]> {
    const results = await firestoreService.getCollection<PracticeResult>(COLLECTIONS.PRACTICE_RESULTS, [
      where("practiceTestId", "==", testId),
    ]);
    return results.sort((a, b) => b.finalScore - a.finalScore);
  },

  async getStudentResults(studentId: string): Promise<PracticeResult[]> {
    const results = await firestoreService.getCollection<PracticeResult>(COLLECTIONS.PRACTICE_RESULTS, [
      where("studentId", "==", studentId),
    ]);
    return results.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  },

  /**
   * 14. Compute comprehensive analytics for a test
   */
  async getTestAnalytics(testId: string): Promise<PracticeAnalytics | null> {
    const [test, results] = await Promise.all([this.getTestById(testId), this.getTestResults(testId)]);

    if (!test) return null;
    if (results.length === 0) {
      return {
        testId,
        title: test.title,
        totalAttempts: 0,
        uniqueStudents: 0,
        completionRate: 100,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        averageDurationSeconds: 0,
        difficultyStats: {
          easy: { count: 0, avgAccuracy: 0 },
          medium: { count: 0, avgAccuracy: 0 },
          hard: { count: 0, avgAccuracy: 0 },
        },
        frequentlyMissedQuestions: [],
      };
    }

    const uniqueStudents = new Set(results.map((r) => r.studentId)).size;
    const scores = results.map((r) => r.finalScore);
    const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / results.length) * 10) / 10;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    const avgDuration = Math.round(results.reduce((a, b) => a + (b.completionTime || 0), 0) / results.length);

    let easyTotal = 0,
      easyCorrect = 0;
    let medTotal = 0,
      medCorrect = 0;
    let hardTotal = 0,
      hardCorrect = 0;

    results.forEach((r) => {
      if (r.breakdownByDifficulty) {
        easyTotal += r.breakdownByDifficulty.easy.total;
        easyCorrect += r.breakdownByDifficulty.easy.correct;
        medTotal += r.breakdownByDifficulty.medium.total;
        medCorrect += r.breakdownByDifficulty.medium.correct;
        hardTotal += r.breakdownByDifficulty.hard.total;
        hardCorrect += r.breakdownByDifficulty.hard.correct;
      }
    });

    return {
      testId,
      title: test.title,
      totalAttempts: results.length,
      uniqueStudents,
      completionRate: 100,
      averageScore: avgScore,
      highestScore,
      lowestScore,
      averageDurationSeconds: avgDuration,
      difficultyStats: {
        easy: { count: easyTotal, avgAccuracy: easyTotal > 0 ? Math.round((easyCorrect / easyTotal) * 100) : 0 },
        medium: { count: medTotal, avgAccuracy: medTotal > 0 ? Math.round((medCorrect / medTotal) * 100) : 0 },
        hard: { count: hardTotal, avgAccuracy: hardTotal > 0 ? Math.round((hardCorrect / hardTotal) * 100) : 0 },
      },
      frequentlyMissedQuestions: [],
    };
  },

  /**
   * 15. Assignments Management
   */
  async assignTest(assignment: Omit<PracticeAssignment, "id" | "assignedAt">, adminId: string = "admin"): Promise<PracticeAssignment> {
    const id = `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullAssignment: PracticeAssignment = {
      ...assignment,
      id,
      assignedAt: new Date().toISOString(),
      assignedBy: adminId,
    };
    await firestoreService.setDocument(COLLECTIONS.PRACTICE_ASSIGNMENTS, id, fullAssignment);
    await auditService.logAction(adminId, "PRACTICE_TEST_ASSIGNED", "practice_assignments", id, {
      testId: assignment.practiceTestId,
      batches: assignment.assignedBatches,
      dueDate: assignment.dueDate,
    });
    return fullAssignment;
  },

  subscribeToAssignments(onUpdate: (assignments: PracticeAssignment[]) => void): Unsubscribe {
    return firestoreService.subscribeToCollection<PracticeAssignment>(COLLECTIONS.PRACTICE_ASSIGNMENTS, [], onUpdate);
  },
};
