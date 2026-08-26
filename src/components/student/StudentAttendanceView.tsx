import React, { useState, useMemo } from "react";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Award,
  Flame,
} from "lucide-react";
import { Student } from "../../types";
import { formatDisplayDate } from "../../utils/studentFormatters";

interface StudentAttendanceViewProps {
  student: Student;
}

export const StudentAttendanceView: React.FC<StudentAttendanceViewProps> = ({ student }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const attendanceMap = useMemo(() => {
    return student.attendance || {};
  }, [student.attendance]);

  // Overall attendance statistics
  const stats = useMemo(() => {
    const entries = Object.entries(attendanceMap).filter(([_, val]) => val !== "na");
    const total = entries.length;
    if (total === 0) {
      return { total: 0, present: 0, absent: 0, percentage: 100, streak: 0 };
    }

    const present = entries.filter(([_, val]) => val === true).length;
    const absent = total - present;
    const percentage = Math.round((present / total) * 100);

    // Calculate current streak
    const sortedDates = Object.keys(attendanceMap).sort().reverse();
    let streak = 0;
    for (const d of sortedDates) {
      if (attendanceMap[d] === true) {
        streak++;
      } else if (attendanceMap[d] === false) {
        break;
      }
    }

    return { total, present, absent, percentage, streak };
  }, [attendanceMap]);

  // Calendar month dates generation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const firstDayIndex = useMemo(() => {
    return new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday ...
  }, [year, month]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Calendar cells
  const calendarCells = useMemo(() => {
    const cells = [];

    // Blank cells before first day
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: null, dateStr: "", status: null });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const rawVal = attendanceMap[dateStr];
      let status: "present" | "absent" | "na" | "future" = "future";

      const cellDate = new Date(year, month, d);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (rawVal === true) {
        status = "present";
      } else if (rawVal === false) {
        status = "absent";
      } else if (rawVal === "na") {
        status = "na";
      } else if (cellDate > today) {
        status = "future";
      }

      cells.push({ day: d, dateStr, status });
    }

    return cells;
  }, [year, month, daysInMonth, firstDayIndex, attendanceMap]);

  // Days list for this month
  const monthlyLog = useMemo(() => {
    const log: Array<{ dateStr: string; status: "present" | "absent" | "na" }> = [];
    for (let d = daysInMonth; d >= 1; d--) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const rawVal = attendanceMap[dateStr];

      if (rawVal === true) {
        log.push({ dateStr, status: "present" });
      } else if (rawVal === false) {
        log.push({ dateStr, status: "absent" });
      } else if (rawVal === "na") {
        log.push({ dateStr, status: "na" });
      }
    }
    return log;
  }, [year, month, daysInMonth, attendanceMap]);

  return (
    <div id="student-attendance-view" className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header & Stats Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Attendance & Participation
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time attendance record, daily check-in calendar, and session streak
            </p>
          </div>

          {stats.streak > 1 && (
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-2xl">
              <Flame className="w-5 h-5 text-amber-500 fill-amber-400" />
              <div>
                <div className="text-xs font-black text-amber-900 dark:text-amber-300">
                  {stats.streak} Days Active Streak
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                  Consistent attendance!
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Recorded Days
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {stats.total} Days
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Present Days
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.present} Days
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Absent Days
            </span>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
              {stats.absent} Days
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Attendance %
            </span>
            <div
              className={`text-xl font-black mt-0.5 ${
                stats.percentage >= 85
                  ? "text-emerald-600 dark:text-emerald-400"
                  : stats.percentage >= 75
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {stats.percentage}%
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Monthly Calendar & Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar (2 Columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {monthName} {year}
            </h2>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarCells.map((cell, idx) => {
              if (!cell.day) {
                return <div key={`empty-${idx}`} className="h-10 sm:h-14" />;
              }

              let bgClass = "bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300";
              let badge = null;

              if (cell.status === "present") {
                bgClass = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
                badge = <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />;
              } else if (cell.status === "absent") {
                bgClass = "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
                badge = <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1" />;
              } else if (cell.status === "na") {
                bgClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
                badge = <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1" />;
              }

              return (
                <div
                  key={cell.dateStr}
                  className={`h-10 sm:h-14 rounded-xl p-1.5 flex flex-col items-center justify-between text-xs font-bold transition select-none ${bgClass}`}
                >
                  <span>{cell.day}</span>
                  {badge}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400 font-semibold">Present</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-slate-600 dark:text-slate-400 font-semibold">Absent</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-600 dark:text-slate-400 font-semibold">Holiday / N/A</span>
            </div>
          </div>
        </div>

        {/* Monthly Attendance Log (1 Column) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {monthName} Activity Log
            </h3>
            <span className="text-xs text-slate-400 font-semibold">
              {monthlyLog.length} recorded
            </span>
          </div>

          {monthlyLog.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-8">
              No attendance recorded for {monthName} {year} yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {monthlyLog.map((item) => (
                <div
                  key={item.dateStr}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {formatDisplayDate(item.dateStr)}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      item.status === "present"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : item.status === "absent"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
