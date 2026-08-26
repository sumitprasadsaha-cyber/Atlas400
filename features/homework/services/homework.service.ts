import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { HomeworkItem, HomeworkSubmission } from "../types";
import { where, orderBy } from "firebase/firestore";

export const homeworkService = {
  async getHomeworkByClass(classId: string): Promise<HomeworkItem[]> {
    return firestoreService.getCollection<HomeworkItem>(COLLECTIONS.HOMEWORK, [
      where("classId", "==", classId),
      orderBy("dueDate", "asc"),
    ]);
  },

  async createHomework(homework: HomeworkItem): Promise<void> {
    await firestoreService.setDocument(COLLECTIONS.HOMEWORK, homework.id, homework);
  },

  async submitHomework(submission: HomeworkSubmission): Promise<void> {
    await firestoreService.setDocument("homework_submissions" as any, submission.id, submission);
  },
};
