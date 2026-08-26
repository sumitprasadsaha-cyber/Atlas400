import { logger } from "./logger";

export const safeLocalStorage = {
  getItem<T>(key: string, fallback: T): T {
    try {
      if (typeof window === "undefined") return fallback;
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : fallback;
    } catch (e) {
      logger.warn(`Failed to read from localStorage: ${key}`, { error: e });
      return fallback;
    }
  },

  setItem<T>(key: string, value: T): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      logger.error(`Failed to write to localStorage: ${key}`, e);
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.localStorage.removeItem(key);
      return true;
    } catch (e) {
      logger.warn(`Failed to remove item from localStorage: ${key}`, { error: e });
      return false;
    }
  },

  clear(): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.localStorage.clear();
      return true;
    } catch (e) {
      logger.error("Failed to clear localStorage", e);
      return false;
    }
  },
};
