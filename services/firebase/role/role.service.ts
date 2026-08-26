import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase.config";
import { UserRole } from "../../../shared/types/auth.types";
import { COLLECTIONS } from "../firestore/collections";
import { logger } from "../../../shared/utils/logger";
import { firestoreService } from "../firestore/firestore.service";
import { AdminDoc, UserDoc } from "../../../shared/types/user.types";

export const roleService = {
  /**
   * Authoritatively determines the role of a user strictly from Firestore.
   * Never infers role from client-side tokens.
   */
  async getUserRole(uid: string): Promise<UserRole> {
    try {
      // 1. Check if user is in admins collection
      const adminDoc = await firestoreService.getDocument<AdminDoc>(COLLECTIONS.ADMINS, uid);
      if (adminDoc) {
        return "admin";
      }

      // 2. Check role in users collection
      const userDoc = await firestoreService.getDocument<UserDoc>(COLLECTIONS.USERS, uid);
      if (userDoc?.role === "admin") {
        return "admin";
      }

      return "student";
    } catch (error) {
      logger.error("Error retrieving user role from Firestore", error, { uid });
      return "student";
    }
  },

  /**
   * Checks if a given UID has administrator privileges.
   */
  async isAdmin(uid: string): Promise<boolean> {
    const role = await this.getUserRole(uid);
    return role === "admin";
  },

  /**
   * Sets or updates user role in Firestore.
   */
  async setUserRole(uid: string, role: UserRole): Promise<void> {
    await firestoreService.updateDocument(COLLECTIONS.USERS, uid, { role });
    if (role === "admin") {
      const user = await firestoreService.getDocument<UserDoc>(COLLECTIONS.USERS, uid);
      if (user) {
        await firestoreService.setDocument(COLLECTIONS.ADMINS, uid, {
          uid,
          name: user.displayName || user.email.split("@")[0],
          email: user.email,
          permissions: ["admin.all"],
        });
      }
    } else {
      try {
        await firestoreService.deleteDocument(COLLECTIONS.ADMINS, uid);
      } catch {
        // Document might not exist in admins collection
      }
    }
    logger.info("User role updated authoritatively in Firestore", { uid, role });
  },
};
