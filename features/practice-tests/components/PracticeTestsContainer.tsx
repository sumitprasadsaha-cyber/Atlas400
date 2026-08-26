import React from "react";
import { usePracticeTests } from "../hooks/usePracticeTests";
import { Award, Clock, HelpCircle, CheckCircle } from "lucide-react";

interface PracticeTestsContainerProps {
  classId: string;
  subjectId: string;
  onSelectTest?: (testId: string) => void;
}

export const PracticeTestsContainer: React.FC<PracticeTestsContainerProps> = ({
  classId,
  subjectId,
  onSelectTest,
}) => {
  const { tests, isLoading, error } = usePracticeTests(classId, subjectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
        <span>Loading assessments...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Practice Tests</h2>
        <span className="text-xs text-slate-500">{tests.length} available</span>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-xl">
          <Award className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No practice tests scheduled yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tests.map((test) => (
            <div
              key={test.id}
              onClick={() => onSelectTest && onSelectTest(test.id)}
              className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm cursor-pointer transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">{test.title}</h3>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                  {test.totalMarks} Marks
                </span>
              </div>
              <div className="flex items-center space-x-4 text-xs text-slate-500">
                <span className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {test.durationMinutes} mins
                </span>
                <span className="flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {test.questions.length} questions
                </span>
                <span className="flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  Pass: {test.passingMarks}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
