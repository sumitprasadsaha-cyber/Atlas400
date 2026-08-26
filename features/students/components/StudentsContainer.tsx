import React, { useState } from "react";
import { useStudents } from "../hooks/useStudents";
import { Search, UserPlus, Phone, BookOpen } from "lucide-react";

export const StudentsContainer: React.FC = () => {
  const { students, isLoading, error } = useStudents();
  const [search, setSearch] = useState("");

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.academic?.classGrade?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span>Loading student roster...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Student Directory</h1>
          <p className="text-xs text-slate-500">{students.length} total enrolled</p>
        </div>
        <button
          type="button"
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Student</span>
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name or class..."
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((student) => (
          <div key={student.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-blue-200 transition">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{student.name}</h3>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  student.serviceStatus === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : student.serviceStatus === "paused"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {student.serviceStatus}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex items-center">
                <BookOpen className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <span>Class: {student.academic?.classGrade || "N/A"}</span>
              </div>
              {student.parent?.phone && (
                <div className="flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  <span>{student.parent.phone}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
