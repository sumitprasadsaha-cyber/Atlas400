export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subjects: string[];
  classes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
