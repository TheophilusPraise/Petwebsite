import axios from "axios";

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || "Termii";
const TERMII_API_BASE = process.env.TERMII_API_BASE || "https://v3.api.termii.com";

export async function sendOTPSMSWithTermii(phone, otp) {
  const dest = phone.startsWith("+") ? phone : "+" + phone;
  console.log(`[Termii] Sending OTP to ${dest} | OTP: ${otp}`);
  try {
    const res = await axios.post(`${TERMII_API_BASE}/api/sms/send`, { // <<<< CORRECTED
      to: dest,
      from: TERMII_SENDER_ID,
      sms: `Your PetCare verification code is: ${otp}`,
      type: "plain",
      channel: "generic",
      api_key: TERMII_API_KEY,
    });
    console.log("[Termii] Response:", res.data);
    return res.data;
  } catch (err) {
    if (err.response) {
      console.error("[Termii] Error (API):", err.response.data);
    } else {
      console.error("[Termii] Error:", err.message);
    }
    throw err;
  }
}
