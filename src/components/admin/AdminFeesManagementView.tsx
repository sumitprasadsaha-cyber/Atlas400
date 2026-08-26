import React, { useState, useMemo } from "react";
import {
  IndianRupee,
  Search,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  Printer,
  Receipt,
  Plus,
  ArrowUpRight,
  Clock,
  X,
  CreditCard,
  Send
} from "lucide-react";
import { Student } from "../../types";
import { adminService } from "../../lib/adminService";
import { formatCurrency } from "../../../shared/utils";

interface AdminFeesManagementViewProps {
  students: Student[];
  onUpdateStudentsList: (students: Student[]) => void;
  initialSelectedStudentId?: string;
}

export const AdminFeesManagementView: React.FC<AdminFeesManagementViewProps> = ({
  students,
  onUpdateStudentsList,
  initialSelectedStudentId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "due">("all");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString("en-US", { month: "long" })
  );

  // Fee Collection Modal State
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectStudent, setCollectStudent] = useState<Student | null>(null);
  const [collectAmount, setCollectAmount] = useState(1500);
  const [collectPaymentMode, setCollectPaymentMode] = useState<"UPI" | "Cash" | "Bank Transfer" | "Card">("UPI");
  const [collectDiscount, setCollectDiscount] = useState(0);
  const [collectRemarks, setCollectRemarks] = useState("Monthly tuition fee payment");

  // Printable Receipt Modal State
  const [receiptData, setReceiptData] = useState<{
    receiptNo: string;
    studentName: string;
    rollNo: string;
    classGrade: string;
    month: string;
    amount: number;
    paymentMode: string;
    date: string;
  } | null>(null);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentMonth = months[new Date().getMonth()];

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(s.rollNo || "").includes(searchTerm) ||
        (s.classGrade && s.classGrade.toLowerCase().includes(searchTerm.toLowerCase()));

      const feeState = s.feeMonths?.[selectedMonth];
      const isPaid = feeState === "paid" || feeState === true || (Boolean(s.feePaidThisMonth) && selectedMonth === currentMonth);

      let matchStatus = true;
      if (statusFilter === "paid") matchStatus = Boolean(isPaid);
      if (statusFilter === "due") matchStatus = !isPaid;

      return matchSearch && matchStatus;
    });
  }, [students, searchTerm, statusFilter, selectedMonth, currentMonth]);

  // Aggregate Metrics for this month
  let totalExpected = 0;
  let totalCollected = 0;
  let totalPending = 0;

  students.forEach((s) => {
    const fee = s.monthlyFee || 1500;
    totalExpected += fee;
    const feeState = s.feeMonths?.[selectedMonth];
    const isPaid = feeState === "paid" || feeState === true || (Boolean(s.feePaidThisMonth) && selectedMonth === currentMonth);
    if (isPaid) {
      totalCollected += fee;
    } else {
      totalPending += fee;
    }
  });

  const handleOpenCollect = (student: Student) => {
    setCollectStudent(student);
    setCollectAmount(student.monthlyFee || 1500);
    setCollectDiscount(0);
    setIsCollectModalOpen(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectStudent) return;

    const netPaid = Math.max(0, collectAmount - collectDiscount);
    const receiptNumber = `ATL-REC-${Date.now().toString().slice(-6)}`;

    const updated = students.map((s) => {
      if (s.id === collectStudent.id) {
        return {
          ...s,
          feeMonths: {
            ...(s.feeMonths || {}),
            [selectedMonth]: "paid" as const,
          },
        };
      }
      return s;
    });

    onUpdateStudentsList(updated);

    await adminService.recordAuditLog({
      adminId: "admin",
      adminEmail: "admin@atlas.tuition",
      action: "fee.collected",
      resource: "fees",
      resourceId: collectStudent.id,
      resourceName: collectStudent.name,
      newValue: {
        month: selectedMonth,
        amount: netPaid,
        mode: collectPaymentMode,
        receiptNo: receiptNumber,
      },
    });

    setIsCollectModalOpen(false);

    // Show receipt
    setReceiptData({
      receiptNo: receiptNumber,
      studentName: collectStudent.name,
      rollNo: String(collectStudent.rollNo || "N/A"),
      classGrade: collectStudent.classGrade,
      month: selectedMonth,
      amount: netPaid,
      paymentMode: collectPaymentMode,
      date: new Date().toLocaleDateString(),
    });
  };

  const handleExportCsv = () => {
    const headers = ["Roll No", "Student Name", "Class", "Month", "Fee Amount", "Status"];
    const rows = filteredStudents.map((s) => {
      const feeState = s.feeMonths?.[selectedMonth];
      const isPaid = feeState === "paid" || feeState === true || (Boolean(s.feePaidThisMonth) && selectedMonth === currentMonth);
      const status = isPaid ? "Paid" : "Due";
      return [
        `"${s.rollNo || ""}"`,
        `"${s.name}"`,
        `"${s.classGrade}"`,
        `"${selectedMonth}"`,
        `"${s.monthlyFee || 1500}"`,
        `"${status}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Atlas_Fees_Report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-fees-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Fee Collection & Financial Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Record payments, generate official receipts, manage fee dues, and track monthly tuition revenue
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Total Revenue Expected ({selectedMonth})
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {formatCurrency(totalExpected)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Across {students.length} active enrollments
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Total Collected ({selectedMonth})
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {formatCurrency(totalCollected)}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
            {Math.round((totalCollected / (totalExpected || 1)) * 100)}% realization rate
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Outstanding Dues ({selectedMonth})
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {formatCurrency(totalPending)}
          </div>
          <span className="text-[10px] text-amber-600 font-bold mt-1 block">
            Requires follow-up
          </span>
        </div>
      </div>

      {/* Month & Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Month Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m} 2026
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Payment Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="all">All Students</option>
              <option value="due">Due / Unpaid Only</option>
              <option value="paid">Paid / Settled Only</option>
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
      </div>

      {/* Fee Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Monthly Fee</th>
                <th className="py-3 px-4">Status ({selectedMonth})</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredStudents.map((s) => {
                const feeState = s.feeMonths?.[selectedMonth];
                const isPaid = feeState === "paid" || feeState === true || (Boolean(s.feePaidThisMonth) && selectedMonth === currentMonth);

                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                      <div className="text-[10px] text-slate-400">Roll: {s.rollNo || "N/A"}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">
                      {s.classGrade}
                    </td>

                    <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                      {formatCurrency(s.monthlyFee || 1500)}
                    </td>

                    <td className="py-3 px-4">
                      {isPaid ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Paid
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Due
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {isPaid ? (
                        <button
                          onClick={() => {
                            setReceiptData({
                              receiptNo: `ATL-REC-${s.id.slice(0, 6)}`,
                              studentName: s.name,
                              rollNo: String(s.rollNo || "N/A"),
                              classGrade: s.classGrade,
                              month: selectedMonth,
                              amount: s.monthlyFee || 1500,
                              paymentMode: "UPI / Direct",
                              date: new Date().toLocaleDateString(),
                            });
                          }}
                          className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenCollect(s)}
                          className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all cursor-pointer shadow-sm shadow-blue-600/20 flex items-center gap-1 ml-auto"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                          <span>Collect Fee</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Fee Modal */}
      {isCollectModalOpen && collectStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Record Fee Payment
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {collectStudent.name} • {selectedMonth}
                </p>
              </div>
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Fee (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Discount / Scholarship (₹)
                  </label>
                  <input
                    type="number"
                    value={collectDiscount}
                    onChange={(e) => setCollectDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={collectPaymentMode}
                  onChange={(e) => setCollectPaymentMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs cursor-pointer font-bold"
                >
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="Cash">Cash at Center</option>
                  <option value="Bank Transfer">NEFT / IMPS Bank Transfer</option>
                  <option value="Card">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Transaction Reference
                </label>
                <input
                  type="text"
                  value={collectRemarks}
                  onChange={(e) => setCollectRemarks(e.target.value)}
                  placeholder="e.g. UPI Ref: 1234567890"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-800 dark:text-emerald-300">Net Amount to Collect:</span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(Math.max(0, collectAmount - collectDiscount))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-md shadow-blue-600/20"
                >
                  Confirm & Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Printable Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Atlas Tuition Official Fee Receipt
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Receipt #{receiptData.receiptNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReceiptData(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Student Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">{receiptData.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Roll No:</span>
                <span className="font-bold text-slate-900 dark:text-white">{receiptData.rollNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Class:</span>
                <span className="font-bold text-slate-900 dark:text-white">{receiptData.classGrade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fee Period:</span>
                <span className="font-bold text-slate-900 dark:text-white">{receiptData.month} 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Mode:</span>
                <span className="font-bold text-slate-900 dark:text-white">{receiptData.paymentMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Date:</span>
                <span className="font-bold text-slate-900 dark:text-white">{receiptData.date}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
                <span className="font-black text-slate-900 dark:text-white">Amount Paid:</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(receiptData.amount)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
