import axios from "axios";
import querystring from "querystring";

const BULKSMSNIG_API_TOKEN = process.env.BULKSMSNIG_API_TOKEN || "nEW8ClBo2XlayJBulY4GVa0I2fT8VzZNuBlXOCkIo6m2T4OtqIMRboUVJbQ9"; // Your API token here or from .env
const BULKSMSNIG_SENDER = process.env.BULKSMSNIG_SENDER || "BulkSMS"; // Default or approved sender, max 11 chars (no spaces)

export async function sendOTPSMSWithBulkSMSNigeria(phone, otp) {
  // Remove leading '+' if present, and any spaces
  const formatted = phone.replace(/^\+/, "").replace(/\s+/g, "");

  const params = {
    api_token: BULKSMSNIG_API_TOKEN,
    from: BULKSMSNIG_SENDER,
    to: formatted,
    body: `Your PetCare OTP is: ${otp}.`,
    dnd: 4 // 4 = deliver everywhere, including DND
  };

  const url = "https://www.bulksmsnigeria.com/api/v1/sms/create";
  try {
    // BulkSMSNigeria expects x-www-form-urlencoded content
    const res = await axios.post(url, querystring.stringify(params), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    console.log("[BulkSMSNigeria] Response:", res.data);
    return res.data;
  } catch (err) {
    if (err.response && err.response.data) {
      console.error("[BulkSMSNigeria] Error (API):", err.response.data);
    } else {
      console.error("[BulkSMSNigeria] Error:", err.message || err);
    }
    throw err;
  }
}
