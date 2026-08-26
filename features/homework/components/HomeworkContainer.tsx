import React from "react";
import { useHomework } from "../hooks/useHomework";
import { BookOpen, Calendar } from "lucide-react";
import { formatDisplayDate } from "../../../shared/utils";

interface HomeworkContainerProps {
  classId: string;
}

export const HomeworkContainer: React.FC<HomeworkContainerProps> = ({ classId }) => {
  const { items, isLoading, error } = useHomework(classId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mr-2"></div>
        <span>Loading assignments...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Homework & Tasks</h2>
        <span className="text-xs text-slate-500">{items.length} tasks</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No active homework assignments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((hw) => (
            <div key={hw.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
              <h3 className="text-sm font-semibold text-slate-800">{hw.title}</h3>
              <p className="text-xs text-slate-600">{hw.description}</p>
              <div className="flex items-center text-xs text-amber-600 pt-2 font-medium">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                <span>Due: {formatDisplayDate(hw.dueDate)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
