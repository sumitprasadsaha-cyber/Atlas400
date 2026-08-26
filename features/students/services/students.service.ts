import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { Student } from "../../../shared/types/student.types";
import { orderBy, Unsubscribe } from "firebase/firestore";

export const studentsService = {
  async getAllStudents(): Promise<Student[]> {
    return firestoreService.getCollection<Student>(COLLECTIONS.STUDENTS, [
      orderBy("name", "asc"),
    ]);
  },

  async getStudentById(studentId: string): Promise<Student | null> {
    return firestoreService.getDocument<Student>(COLLECTIONS.STUDENTS, studentId);
  },

  async saveStudent(student: Student): Promise<void> {
    await firestoreService.setDocument(COLLECTIONS.STUDENTS, student.id, student);
  },

  async deleteStudent(studentId: string): Promise<void> {
    await firestoreService.deleteDocument(COLLECTIONS.STUDENTS, studentId);
  },

  subscribeToStudents(onUpdate: (students: Student[]) => void): Unsubscribe {
    return firestoreService.subscribeToCollection<Student>(
      COLLECTIONS.STUDENTS,
      [orderBy("name", "asc")],
      onUpdate
    );
  },
};
