import { useState, useEffect, useCallback } from "react";
import { FeeTransaction } from "../types";
import { feesService } from "../services/fees.service";

export function useFees(studentId?: string) {
  const [transactions, setTransactions] = useState<FeeTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    if (!studentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await feesService.getStudentFees(studentId);
      setTransactions(data);
    } catch (e: any) {
      setError(e.message || "Failed to load fee records");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  return { transactions, isLoading, error, refresh: fetchFees };
}
