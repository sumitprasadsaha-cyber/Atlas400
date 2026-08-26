import { useState, useEffect, useCallback } from "react";
import { AppSettings } from "../types";
import { settingsService } from "../services/settings.service";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (e: any) {
      setError(e.message || "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updated: Partial<AppSettings>) => {
    await settingsService.updateSettings(updated);
    setSettings((prev) => (prev ? { ...prev, ...updated } : null));
  };

  return { settings, isLoading, error, updateSettings, refresh: fetchSettings };
}
