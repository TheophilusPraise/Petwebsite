// services/dashboardService.js
import { countAll, getUpcoming } from '../models/bookingModel.js';
import { countAll as countAllPets } from '../models/petModel.js';
import { getRecent } from './notificationService.js'; // Named import

export const getStats = async () => {
  const totalBookings = await countAll();
  const upcomingBookings = await getUpcoming();
  const totalPets = await countAllPets();
  return { totalBookings, upcomingBookings, totalPets };
};

export const getRecentNotifications = async () => {
  return await getRecent(); // Use the named import
};
