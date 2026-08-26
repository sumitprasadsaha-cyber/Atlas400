import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { NotificationItem } from "../types";
import { orderBy } from "firebase/firestore";

export const notificationsService = {
  async getNotifications(): Promise<NotificationItem[]> {
    return firestoreService.getCollection<NotificationItem>(COLLECTIONS.NOTIFICATIONS, [
      orderBy("createdAt", "desc"),
    ]);
  },

  async sendNotification(item: NotificationItem): Promise<void> {
    await firestoreService.setDocument(COLLECTIONS.NOTIFICATIONS, item.id, item);
  },
};
