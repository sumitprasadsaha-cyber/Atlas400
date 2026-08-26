import { Permission, UserRole } from "../../../shared/types/auth.types";
import { ROLE_PERMISSIONS } from "../../../shared/constants/permissions.constants";
import { COLLECTIONS } from "../firestore/collections";
import { firestoreService } from "../firestore/firestore.service";
import { AdminDoc } from "../../../shared/types/user.types";
import { logger } from "../../../shared/utils/logger";

export const permissionService = {
  /**
   * Retrieves permissions for a specific user based on their role and admin document.
   */
  async getUserPermissions(uid: string, role: UserRole): Promise<Permission[]> {
    if (role === "student") {
      return [...ROLE_PERMISSIONS.student];
    }

    try {
      const adminDoc = await firestoreService.getDocument<AdminDoc>(COLLECTIONS.ADMINS, uid);
      if (adminDoc?.permissions && Array.isArray(adminDoc.permissions) && adminDoc.permissions.length > 0) {
        return adminDoc.permissions as Permission[];
      }
    } catch (error) {
      logger.warn("Could not load custom permissions for admin from Firestore, defaulting to admin.all", { uid });
    }

    return [...ROLE_PERMISSIONS.admin];
  },

  /**
   * Evaluates if the permissions set contains the requested permission.
   */
  hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
    if (userPermissions.includes("admin.all")) {
      return true;
    }
    return userPermissions.includes(requiredPermission);
  },
};
