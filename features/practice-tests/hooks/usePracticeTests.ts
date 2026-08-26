import { useState, useEffect, useCallback } from "react";
import { PracticeTest } from "../../../shared/types/practice-tests.types";
import { practiceTestsService } from "../services/practice-tests.service";
import { logger } from "../../../shared/utils/logger";

export function usePracticeTests(classId?: string, subjectId?: string) {
  const [tests, setTests] = useState<PracticeTest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTests = useCallback(async () => {
    if (!classId || !subjectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await practiceTestsService.getTests({ subject: subjectId });
      setTests(data);
    } catch (e: any) {
      logger.error("usePracticeTests: Failed to fetch tests", e);
      setError(e.message || "Failed to load practice tests");
    } finally {
      setIsLoading(false);
    }
  }, [classId, subjectId]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const submitAttempt = async (payload: {
    attemptId: string;
    studentId: string;
    studentName?: string;
    practiceTestId: string;
    r2ObjectKey: string;
    answers: Record<string, any>;
    timeTaken: number;
    startedAt?: string;
  }) => {
    return await practiceTestsService.submitAttempt(payload);
  };

  return {
    tests,
    isLoading,
    error,
    refresh: fetchTests,
    submitAttempt,
  };
}
