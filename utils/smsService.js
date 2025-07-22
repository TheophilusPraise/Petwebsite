import axios from "axios";

// phone must be in international format (e.g. 2348012345678, no '+')
export async function sendOTPSMS(phone, otp) {
  // Log the attempt
  console.log(`[SMS] Attempting to send OTP SMS to: ${phone} | OTP: ${otp}`);

  // Use approved sender name from .env or fallback to "Schamp"
  const senderName = process.env.SENDCHAMP_SENDER_NAME || "Schamp"; // <-- String only!

  try {
    const res = await axios.post(
      "https://api.sendchamp.com/api/v1/sms/send",
      {
        to: [phone], // Must be an array!
        message: `Your PetCare verification code is: ${otp}`,
        sender_name: senderName,      // MUST be a string, not variable without quotes!
        route: "dnd"                  // Use "dnd" for best Nigerian delivery
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDCHAMP_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    // Log the API response
    console.log("[SMS] Sendchamp response:", res.data);

    if (res.data.status !== "success") {
      console.error("[SMS] Sendchamp OTP SMS failed:", res.data);
    }
    return res.data;
  } catch (err) {
    // Log all errors
    if (err.response) {
      console.error("[SMS] Sendchamp OTP SMS error (API):", err.response.data);
    } else {
      console.error("[SMS] Sendchamp OTP SMS error:", err.message);
    }
    throw err;
  }
}
