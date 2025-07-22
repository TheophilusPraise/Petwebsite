import axios from "axios";
import querystring from "querystring";

const KUDISMS_API_KEY = process.env.KUDISMS_API_KEY;
const KUDISMS_SENDER = process.env.KUDISMS_SENDER || "KudiSMS";

export async function sendOTPSMSWithKudiSMS(phone, otp) {
  const formatted = phone.replace(/^\+/, "");
  const params = {
    api_key: KUDISMS_API_KEY,
    sender: KUDISMS_SENDER,
    to: formatted,
    message: `Your PetCare OTP code is: ${otp}`,
  };

  const url = "https://kudisms.net/api/?" + querystring.stringify(params);

  try {
    const res = await axios.get(url);
    console.log("[KudiSMS] Response:", res.data);
    return res.data;
  } catch (err) {
    if (err.response && err.response.data) {
      console.error("[KudiSMS] Error (API):", err.response.data);
    } else {
      console.error("[KudiSMS] Error:", err.message || err);
    }
    throw err;
  }
}
