import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { FeeTransaction } from "../types";
import { where, orderBy } from "firebase/firestore";

export const feesService = {
  async getStudentFees(studentId: string): Promise<FeeTransaction[]> {
    return firestoreService.getCollection<FeeTransaction>(COLLECTIONS.FEES, [
      where("studentId", "==", studentId),
      orderBy("month", "desc"),
    ]);
  },

  async recordPayment(transaction: FeeTransaction): Promise<void> {
    await firestoreService.setDocument(COLLECTIONS.FEES, transaction.id, transaction);
  },
};
