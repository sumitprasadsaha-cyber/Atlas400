export interface FeeTransaction {
  id: string;
  studentId: string;
  studentName?: string;
  month: string; // YYYY-MM
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: "paid" | "partial" | "pending";
  paymentDate?: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
}
