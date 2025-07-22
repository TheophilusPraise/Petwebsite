import { sendOTPSMS } from "./smsService.js";
import { sendOTPWhatsApp } from "./whatsappService.js";
import { sendOTPEmail } from "./emailService.js"; // If you want email too

export async function sendOTPAllChannels({ phone, email, otp }) {
  // You could run them in parallel with Promise.all if you wish
  const results = [];
  if (email) {
    results.push(sendOTPEmail(email, otp));
  }
  if (phone) {
    results.push(sendOTPSMS(phone, otp));
    results.push(sendOTPWhatsApp(phone, otp));
  }
  await Promise.allSettled(results); // Wait for all to finish, whether success or fail
}
