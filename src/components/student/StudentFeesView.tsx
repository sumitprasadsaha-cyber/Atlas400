import React, { useState, useMemo } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  FileText,
  DollarSign,
  QrCode,
  Sparkles,
  Printer,
  X,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Student } from "../../types";
import { formatCurrency, formatDisplayDate } from "../../utils/studentFormatters";

interface StudentFeesViewProps {
  student: Student;
}

interface FeeLedgerRow {
  month: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: "paid" | "unpaid" | "na";
  paymentDate?: string;
  paymentMode?: string;
  receiptId?: string;
}

export const StudentFeesView: React.FC<StudentFeesViewProps> = ({ student }) => {
  const [selectedReceipt, setSelectedReceipt] = useState<FeeLedgerRow | null>(null);

  // Generate Fee Ledger Rows
  const ledgerRows = useMemo<FeeLedgerRow[]>(() => {
    const monthlyFee = student.monthlyFee || 0;
    const feeMonths = student.feeMonths || {};
    const paymentDates = student.feePaymentDates || {};

    // Get list of months
    const monthKeys = Object.keys(feeMonths);
    if (monthKeys.length === 0) {
      // Default generate recent months
      const currentMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const isPaid = student.feePaidThisMonth;
      return [
        {
          month: currentMonth,
          amount: monthlyFee,
          paidAmount: isPaid ? monthlyFee : 0,
          dueAmount: isPaid ? 0 : monthlyFee,
          status: isPaid ? "paid" : "unpaid",
          paymentDate: isPaid ? new Date().toISOString().split("T")[0] : undefined,
          paymentMode: "UPI / Online",
          receiptId: `REC-${student.id.slice(-4)}-01`,
        },
      ];
    }

    return monthKeys.map((m, idx) => {
      const status = feeMonths[m] || "unpaid";
      const isPaid = status === "paid";
      const pDate = paymentDates[m];

      return {
        month: m,
        amount: monthlyFee,
        paidAmount: isPaid ? monthlyFee : 0,
        dueAmount: isPaid ? 0 : monthlyFee,
        status,
        paymentDate: pDate,
        paymentMode: "Online Transfer / UPI",
        receiptId: `REC-${student.id.slice(-4)}-${String(idx + 1).padStart(2, "0")}`,
      };
    });
  }, [student]);

  // Overall financial summary
  const summary = useMemo(() => {
    const totalBilled = ledgerRows.reduce((sum, r) => sum + (r.status !== "na" ? r.amount : 0), 0);
    const totalPaid = ledgerRows.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalDue = ledgerRows.reduce((sum, r) => sum + r.dueAmount, 0);
    const currentMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const currentMonthRow = ledgerRows.find((r) => r.month === currentMonth);
    const isCurrentPaid = currentMonthRow ? currentMonthRow.status === "paid" : student.feePaidThisMonth;

    return { totalBilled, totalPaid, totalDue, isCurrentPaid };
  }, [ledgerRows, student.feePaidThisMonth]);

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div id="student-fees-view" className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header & Status Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Fee Ledger & Payment Receipts
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Transparent monthly tuition accounting, payment vouchers, and dues breakdown
            </p>
          </div>

          <div
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-2xl border ${
              summary.isCurrentPaid
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            }`}
          >
            {summary.isCurrentPaid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <div className="text-xs font-black">
                {summary.isCurrentPaid ? "Fees Up to Date" : "Monthly Dues Pending"}
              </div>
              <div className="text-[10px] font-semibold opacity-80">
                {summary.isCurrentPaid ? "No outstanding balances" : `Outstanding: ${formatCurrency(summary.totalDue)}`}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly Tuition</span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {formatCurrency(student.monthlyFee || 0)}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Paid</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(summary.totalPaid)}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Dues</span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {formatCurrency(summary.totalDue)}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrolled Batch</span>
            <div className="text-base font-black text-slate-700 dark:text-slate-300 mt-1 truncate">
              {student.classGrade || "Standard"}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Fee Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Monthly Fee Ledger
          </h2>
          <span className="text-xs text-slate-400 font-semibold">
            {ledgerRows.length} bill cycles
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-3 px-3">Billing Month</th>
                <th className="pb-3 px-3">Amount</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Payment Date</th>
                <th className="pb-3 px-3">Mode</th>
                <th className="pb-3 px-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
              {ledgerRows.map((row) => (
                <tr key={row.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                    {row.month}
                  </td>
                  <td className="py-3.5 px-3">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        row.status === "paid"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : row.status === "unpaid"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {row.status === "paid" ? "PAID" : row.status === "unpaid" ? "DUE" : "N/A"}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-500">
                    {row.paymentDate ? formatDisplayDate(row.paymentDate) : "—"}
                  </td>
                  <td className="py-3.5 px-3 text-slate-500">
                    {row.status === "paid" ? row.paymentMode || "Online" : "—"}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    {row.status === "paid" ? (
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(row)}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Unpaid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Tuition Fee Receipt
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ref: {selectedReceipt.receiptId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Student Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">{student.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Student ID / Roll:</span>
                <span className="font-bold text-slate-900 dark:text-white">{student.rollNo || student.id.slice(-6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Class Grade:</span>
                <span className="font-bold text-slate-900 dark:text-white">{student.classGrade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Billing Period:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedReceipt.month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Date:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedReceipt.paymentDate ? formatDisplayDate(selectedReceipt.paymentDate) : "Confirmed"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedReceipt.paymentMode}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm">
                <span className="font-bold text-slate-900 dark:text-white">Amount Paid:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedReceipt.paidAmount)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
