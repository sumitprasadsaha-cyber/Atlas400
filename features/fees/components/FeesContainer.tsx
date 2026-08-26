import React from "react";
import { useFees } from "../hooks/useFees";
import { CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { formatCurrency } from "../../../shared/utils";

interface FeesContainerProps {
  studentId: string;
}

export const FeesContainer: React.FC<FeesContainerProps> = ({ studentId }) => {
  const { transactions, isLoading, error } = useFees(studentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-2"></div>
        <span>Loading fee transactions...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Fee Ledger</h2>
        <span className="text-xs text-slate-500">{transactions.length} entries</span>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl">
          <CreditCard className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No fee history available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
              <div>
                <div className="text-sm font-semibold text-slate-800">Month: {tx.month}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Paid: {formatCurrency(tx.paidAmount)} / Due: {formatCurrency(tx.dueAmount)}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900">{formatCurrency(tx.amount)}</span>
                {tx.status === "paid" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
