import { AuthUser } from "../../shared/types/auth.types";
import { STORAGE_KEYS } from "../../shared/constants/storage.constants";
import { safeLocalStorage } from "../../shared/utils/storage";

export const sessionService = {
  saveSession(user: AuthUser): void {
    safeLocalStorage.setItem(STORAGE_KEYS.USER_SESSION, user);
  },

  getSession(): AuthUser | null {
    return safeLocalStorage.getItem<AuthUser | null>(STORAGE_KEYS.USER_SESSION, null);
  },

  clearSession(): void {
    safeLocalStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    safeLocalStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
    safeLocalStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  isLoggedIn(): boolean {
    return this.getSession() !== null;
  },
};
