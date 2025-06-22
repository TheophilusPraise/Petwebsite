// services/notificationService.js
import { getRecentNotifications, createNotification } from '../models/notificationModel.js';

export const getRecent = async () => {
  return await getRecentNotifications();
};

export const sendNotification = async (userId, message) => {
  await createNotification(userId, message);
};
