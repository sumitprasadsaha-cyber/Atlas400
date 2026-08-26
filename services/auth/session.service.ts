import { AuthUser, Permission, SessionData, UserRole } from "../../shared/types/auth.types";
import { STORAGE_KEYS } from "../../shared/constants/storage.constants";
import { safeLocalStorage } from "../../shared/utils/storage";
import { roleService } from "../firebase/role/role.service";
import { permissionService } from "../firebase/permission/permission.service";
import { logger } from "../../shared/utils/logger";
import { ROLE_PERMISSIONS } from "../../shared/constants/permissions.constants";

export const sessionService = {
  /**
   * Persists active session data locally.
   */
  saveSession(user: AuthUser, token?: string): void {
    const sessionData: SessionData = {
      user,
      role: user.role,
      permissions: user.permissions || ROLE_PERMISSIONS[user.role],
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      token,
      authenticatedAt: new Date().toISOString(),
    };
    safeLocalStorage.setItem(STORAGE_KEYS.USER_SESSION, sessionData);
    logger.debug("Session persisted", { uid: user.uid, role: user.role });
  },

  /**
   * Reads current active session.
   */
  getSession(): SessionData | null {
    const session = safeLocalStorage.getItem<SessionData | null>(STORAGE_KEYS.USER_SESSION, null);
    if (!session) return null;

    // Check expiration
    if (session.expiresAt && Date.now() > session.expiresAt) {
      this.clearSession();
      return null;
    }

    return session;
  },

  /**
   * Returns current authenticated user or null.
   */
  getCurrentUser(): AuthUser | null {
    const session = this.getSession();
    return session ? session.user : null;
  },

  /**
   * Returns current role.
   */
  getCurrentRole(): UserRole | null {
    const session = this.getSession();
    return session ? session.role : null;
  },

  /**
   * Checks if user is currently logged in.
   */
  isLoggedIn(): boolean {
    return this.getSession() !== null;
  },

  /**
   * Authoritatively validates role against Firestore.
   */
  async validateAuthoritativeRole(uid: string): Promise<UserRole> {
    return await roleService.getUserRole(uid);
  },

  /**
   * Checks if current user has the required permission.
   */
  hasPermission(permission: Permission): boolean {
    const session = this.getSession();
    if (!session) return false;
    return permissionService.hasPermission(session.permissions, permission);
  },

  /**
   * Clears session and cached tokens.
   */
  clearSession(): void {
    safeLocalStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    safeLocalStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
    safeLocalStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    logger.info("Session cleared");
  },
};
