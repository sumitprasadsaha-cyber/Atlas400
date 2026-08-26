import React from "react";
import { useTeachers } from "../hooks/useTeachers";
import { GraduationCap, Mail } from "lucide-react";

export const TeachersContainer: React.FC = () => {
  const { teachers, isLoading, error } = useTeachers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
        <span>Loading faculty list...</span>
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
          <h1 className="text-xl font-bold text-slate-900">Faculty Directory</h1>
          <p className="text-xs text-slate-500">{teachers.length} teachers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {teachers.map((teacher) => (
          <div key={teacher.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{teacher.name}</h3>
                <div className="flex items-center text-xs text-slate-500 mt-0.5">
                  <Mail className="w-3 h-3 mr-1 text-slate-400" />
                  <span>{teacher.email}</span>
                </div>
              </div>
            </div>
            {teacher.subjects && (
              <div className="flex flex-wrap gap-1 pt-1">
                {teacher.subjects.map((sub, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                    {sub}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
