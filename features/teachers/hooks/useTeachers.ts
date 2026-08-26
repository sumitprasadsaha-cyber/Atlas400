import { useState, useEffect, useCallback } from "react";
import { Teacher } from "../../../shared/types/teacher.types";
import { teachersService } from "../services/teachers.service";

export function useTeachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeachers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teachersService.getAllTeachers();
      setTeachers(data);
    } catch (e: any) {
      setError(e.message || "Failed to load teachers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  return { teachers, isLoading, error, refresh: fetchTeachers };
}
