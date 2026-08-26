import React, { useState, useMemo } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Calendar,
  Users,
  Search,
  Check,
  X,
  Sparkles,
  BarChart2
} from "lucide-react";
import { Student } from "../../types";
import { adminService } from "../../lib/adminService";

interface AdminAttendanceManagementViewProps {
  students: Student[];
  onToggleAttendance: (studentId: string, date: string, isPresent: boolean | "na") => void;
  onUpdateStudentsList: (students: Student[]) => void;
}

export const AdminAttendanceManagementView: React.FC<AdminAttendanceManagementViewProps> = ({
  students,
  onToggleAttendance,
  onUpdateStudentsList,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [classFilter, setClassFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const distinctClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.classGrade) set.add(s.classGrade);
    });
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || String(s.rollNo || "").includes(searchTerm);
      const matchClass = classFilter === "all" || s.classGrade === classFilter;
      return matchSearch && matchClass;
    });
  }, [students, searchTerm, classFilter]);

  // Daily statistics
  let presentCount = 0;
  let absentCount = 0;
  let unmarkedCount = 0;

  filteredStudents.forEach((s) => {
    const st = s.attendance?.[selectedDate];
    if (st === true) presentCount += 1;
    else if (st === false) absentCount += 1;
    else unmarkedCount += 1;
  });

  const total = filteredStudents.length;
  const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  // Bulk mark all present
  const handleMarkAll = async (status: boolean) => {
    const updated = students.map((s) => {
      if (filteredStudents.some((fs) => fs.id === s.id)) {
        return {
          ...s,
          attendance: {
            ...(s.attendance || {}),
            [selectedDate]: status,
          },
        };
      }
      return s;
    });

    onUpdateStudentsList(updated);

    await adminService.recordAuditLog({
      adminId: "admin",
      adminEmail: "admin@atlas.tuition",
      action: status ? "attendance.bulk_marked_present" : "attendance.bulk_marked_absent",
      resource: "attendance",
      newValue: { date: selectedDate, count: filteredStudents.length },
    });
  };

  // Export Attendance CSV
  const handleExportCsv = () => {
    const headers = ["Roll No", "Student Name", "Class", "Date", "Status"];
    const rows = filteredStudents.map((s) => {
      const st = s.attendance?.[selectedDate];
      let label = "Unmarked";
      if (st === true) label = "Present";
      else if (st === false) label = "Absent";
      return [`"${s.rollNo || ""}"`, `"${s.name}"`, `"${s.classGrade}"`, `"${selectedDate}"`, `"${label}"`];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Atlas_Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-attendance-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Attendance & Presence Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Daily roll-call registry, batch-level presence rates, and CSV reporting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date & Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Date Picker */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Attendance Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
            />
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Filter Batch / Class
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="all">All Classes ({students.length})</option>
              {distinctClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name or roll no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* Quick Bulk Actions & Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-slate-900 dark:text-white">
              Presence: <span className="text-emerald-600 dark:text-emerald-400">{rate}%</span>
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-emerald-600 font-medium">{presentCount} Present</span>
            <span className="text-slate-400">•</span>
            <span className="text-rose-600 font-medium">{absentCount} Absent</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 font-medium">{unmarkedCount} Unmarked</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMarkAll(true)}
              className="px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-xl transition-all cursor-pointer border border-emerald-200 dark:border-emerald-800"
            >
              ✓ Mark All Present
            </button>
            <button
              onClick={() => handleMarkAll(false)}
              className="px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl transition-all cursor-pointer border border-rose-200 dark:border-rose-800"
            >
              ✕ Mark All Absent
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Overall Rate</th>
                <th className="py-3 px-4 text-center">Status on {selectedDate}</th>
                <th className="py-3 px-4 text-right">Quick Mark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredStudents.map((s) => {
                const currentStatus = s.attendance?.[selectedDate];
                const isPresent = currentStatus === true;
                const isAbsent = currentStatus === false;

                // Calculate personal attendance %
                const attValues = Object.values(s.attendance || {});
                const personalPresent = attValues.filter((v) => v === true).length;
                const personalRate = attValues.length > 0 ? Math.round((personalPresent / attValues.length) * 100) : 100;

                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                      <div className="text-[10px] text-slate-400">Roll: {s.rollNo || "N/A"}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">
                      {s.classGrade}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {personalRate}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isPresent ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Present
                        </span>
                      ) : isAbsent ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          Absent
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Not Marked
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onToggleAttendance(s.id, selectedDate, true)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            isPresent
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600"
                          }`}
                        >
                          P
                        </button>
                        <button
                          onClick={() => onToggleAttendance(s.id, selectedDate, false)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            isAbsent
                              ? "bg-rose-600 text-white shadow-sm"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                          }`}
                        >
                          A
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
