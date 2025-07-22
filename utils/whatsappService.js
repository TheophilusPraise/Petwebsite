import axios from "axios";

export async function sendOTPWhatsApp(phone, otp) {
  console.log(`[WhatsApp] Attempting to send OTP via WhatsApp to: ${phone} | OTP: ${otp}`);
  try {
    const res = await axios.post(
      "https://api.sendchamp.com/api/v1/whatsapp/message/send",
      {
        recipient: phone, // <-- use "recipient" not "to"
        sender: process.env.SENDCHAMP_SENDER_NAME || "Schamp", // optional
        type: "plain",    // or "template" for advanced use
        message: `Your PetCare verification code is: ${otp}`,
        channel: "whatsapp"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDCHAMP_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("[WhatsApp] Sendchamp response:", res.data);
    if (res.data.status !== "success") {
      console.error("[WhatsApp] Sendchamp OTP WhatsApp failed:", res.data);
    }
    return res.data;
  } catch (err) {
    if (err.response) {
      console.error("[WhatsApp] Sendchamp OTP error (API):", err.response.data);
    } else {
      console.error("[WhatsApp] Sendchamp OTP error:", err.message);
    }
    throw err;
  }
}
