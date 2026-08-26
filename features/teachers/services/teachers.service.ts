import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { Teacher } from "../../../shared/types/teacher.types";
import { orderBy } from "firebase/firestore";

export const teachersService = {
  async getAllTeachers(): Promise<Teacher[]> {
    return firestoreService.getCollection<Teacher>(COLLECTIONS.TEACHERS, [
      orderBy("name", "asc"),
    ]);
  },

  async saveTeacher(teacher: Teacher): Promise<void> {
    await firestoreService.setDocument(COLLECTIONS.TEACHERS, teacher.id, teacher);
  },
};
