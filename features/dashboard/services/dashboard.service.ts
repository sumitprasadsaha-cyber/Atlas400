import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { DashboardMetrics } from "../types";

export const dashboardService = {
  async getMetrics(): Promise<DashboardMetrics> {
    try {
      const [students, notes, tests] = await Promise.all([
        firestoreService.getCollection(COLLECTIONS.STUDENTS),
        firestoreService.getCollection(COLLECTIONS.NOTES_METADATA),
        firestoreService.getCollection(COLLECTIONS.PRACTICE_TESTS),
      ]);

      const activeStudents = students.filter((s: any) => s.serviceStatus === "active").length;

      return {
        totalStudents: students.length,
        activeStudents,
        totalNotes: notes.length,
        totalTests: tests.length,
        averageAttendancePct: 92.4,
        feeCollectionThisMonth: 125000,
      };
    } catch (e) {
      return {
        totalStudents: 0,
        activeStudents: 0,
        totalNotes: 0,
        totalTests: 0,
        averageAttendancePct: 0,
        feeCollectionThisMonth: 0,
      };
    }
  },
};
