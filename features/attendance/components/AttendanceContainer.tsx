import React from "react";
import { useAttendance } from "../hooks/useAttendance";
import { UserCheck, Clock } from "lucide-react";
import { formatDisplayDate } from "../../../shared/utils";

interface AttendanceContainerProps {
  studentId?: string;
  classId?: string;
  date?: string;
}

export const AttendanceContainer: React.FC<AttendanceContainerProps> = ({ studentId, classId, date }) => {
  const { records, isLoading, error } = useAttendance(studentId, classId, date);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-2"></div>
        <span>Loading attendance records...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Attendance Log</h2>
        <span className="text-xs text-slate-500">{records.length} records</span>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl">
          <UserCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No attendance entries recorded</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center space-x-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    r.status === "present"
                      ? "bg-emerald-500"
                      : r.status === "absent"
                      ? "bg-red-500"
                      : "bg-amber-500"
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-slate-800 capitalize">{r.status}</div>
                  <div className="text-xs text-slate-400 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDisplayDate(r.date)}
                  </div>
                </div>
              </div>
              {r.remarks && <span className="text-xs text-slate-500 italic">{r.remarks}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
