import { useState, useEffect, useCallback } from "react";
import { AttendanceRecord } from "../types";
import { attendanceService } from "../services/attendance.service";

export function useAttendance(studentId?: string, classId?: string, date?: string) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (studentId) {
        const data = await attendanceService.getStudentAttendance(studentId);
        setRecords(data);
      } else if (classId && date) {
        const data = await attendanceService.getAttendanceByDate(classId, date);
        setRecords(data);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load attendance");
    } finally {
      setIsLoading(false);
    }
  }, [studentId, classId, date]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  return { records, isLoading, error, refresh: fetchAttendance };
}
