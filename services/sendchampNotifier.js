import axios from "axios";

export async function sendSmsWithSendchamp(phone, message) {
  try {
    const res = await axios.post(
      "https://api.sendchamp.com/api/v1/sms/send",
      {
        to: [phone],
        message,
        sender_name: "PetCare", // Can be anything you want or the one set in your Sendchamp dashboard
        route: "non_dnd" // or "dnd" if for DND numbers
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDCHAMP_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return res.data;
  } catch (err) {
    console.error("Sendchamp SMS Error:", err?.response?.data || err.message);
    return null;
  }
}
export async function sendWhatsappWithSendchamp(phone, message) {
  try {
    const res = await axios.post(
      "https://api.sendchamp.com/api/v1/whatsapp/message/send",
      {
        to: phone,
        message,
        sender_name: "PetCare" // Can be anything you want or the one set in your Sendchamp dashboard
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDCHAMP_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return res.data;
  } catch (err) {
    console.error("Sendchamp WhatsApp Error:", err?.response?.data || err.message);
    return null;
  }
}