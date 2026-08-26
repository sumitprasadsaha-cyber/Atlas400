import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { AttendanceRecord, AttendanceStatus } from "../types";
import { where, orderBy } from "firebase/firestore";

export const attendanceService = {
  async getAttendanceByDate(classId: string, date: string): Promise<AttendanceRecord[]> {
    return firestoreService.getCollection<AttendanceRecord>(COLLECTIONS.ATTENDANCE, [
      where("classId", "==", classId),
      where("date", "==", date),
    ]);
  },

  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    return firestoreService.getCollection<AttendanceRecord>(COLLECTIONS.ATTENDANCE, [
      where("studentId", "==", studentId),
      orderBy("date", "desc"),
    ]);
  },

  async markAttendance(records: AttendanceRecord[]): Promise<void> {
    for (const record of records) {
      await firestoreService.setDocument(COLLECTIONS.ATTENDANCE, record.id, record);
    }
  },
};
