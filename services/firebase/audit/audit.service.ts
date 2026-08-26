import { AuditLog } from "../../../shared/types/audit.types";
import { COLLECTIONS } from "../firestore/collections";
import { firestoreService } from "../firestore/firestore.service";
import { validateAuditLog } from "../../../shared/validation/documents.schema";
import { logger } from "../../../shared/utils/logger";

export const auditService = {
  /**
   * Records a structured audit log entry into Firestore.
   */
  async log(entry: Omit<AuditLog, "timestamp"> & { timestamp?: string }): Promise<void> {
    try {
      const validated = validateAuditLog(entry);
      const logId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await firestoreService.setDocument(COLLECTIONS.AUDIT_LOGS, logId, validated, false);
      logger.info(`Audit Log: [${validated.action}] by [${validated.userId}] (${validated.role}) on [${validated.resource}] - ${validated.status}`);
    } catch (error) {
      logger.error("Failed to write audit log to Firestore", error, { action: entry.action, userId: entry.userId });
    }
  },

  /**
   * Alias for log
   */
  async logEvent(entry: Omit<AuditLog, "timestamp"> & { timestamp?: string }): Promise<void> {
    return this.log(entry);
  },

  /**
   * Retrieves recent audit logs (admin only).
   */
  async getRecentLogs(limitCount: number = 50): Promise<AuditLog[]> {
    try {
      return await firestoreService.getCollection<AuditLog>(COLLECTIONS.AUDIT_LOGS);
    } catch (error) {
      logger.error("Failed to fetch audit logs", error);
      return [];
    }
  },
};
