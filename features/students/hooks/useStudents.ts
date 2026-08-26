import { useState, useEffect } from "react";
import { Student } from "../../../shared/types/student.types";
import { studentsService } from "../services/students.service";

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = studentsService.subscribeToStudents((data) => {
      setStudents(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { students, isLoading, error };
}
