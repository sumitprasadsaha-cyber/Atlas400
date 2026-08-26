import { useState, useEffect, useCallback } from "react";
import { HomeworkItem } from "../types";
import { homeworkService } from "../services/homework.service";

export function useHomework(classId?: string) {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHomework = useCallback(async () => {
    if (!classId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await homeworkService.getHomeworkByClass(classId);
      setItems(data);
    } catch (e: any) {
      setError(e.message || "Failed to load homework");
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  return { items, isLoading, error, refresh: fetchHomework };
}
