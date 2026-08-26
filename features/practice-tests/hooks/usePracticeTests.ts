import { useState, useEffect, useCallback } from "react";
import { PracticeTest, StudentTestAttempt } from "../../../shared/types/practice-tests.types";
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
      const data = await practiceTestsService.getTestsBySubject(classId, subjectId);
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

  const submitAttempt = async (attempt: StudentTestAttempt) => {
    await practiceTestsService.submitAttempt(attempt);
  };

  return {
    tests,
    isLoading,
    error,
    refresh: fetchTests,
    submitAttempt,
  };
}
