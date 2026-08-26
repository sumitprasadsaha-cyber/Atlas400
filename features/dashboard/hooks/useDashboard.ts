import { useState, useEffect, useCallback } from "react";
import { DashboardMetrics } from "../types";
import { dashboardService } from "../services/dashboard.service";

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getMetrics();
      setMetrics(data);
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard metrics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { metrics, isLoading, error, refresh: fetchDashboard };
}
