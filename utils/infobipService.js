import axios from "axios";

const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY || "7697d8ef7b0f43ccdee25de54d2313c7-8fa9a662-696a-4089-9701-70c6aa1e3d3f";
const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL || "https://2m8ppz.api.infobip.com";

// For SMS channel
export async function sendOTPSMSWithInfobip(phone, otp) {
  const data = {
    messages: [
      {
        from: "InfoSMS", // Your approved sender (alphanumeric for SMS)
        destinations: [{ to: phone }],
        text: `Your OTP code is: ${otp}`
      }
    ]
  };

  try {
    const res = await axios.post(`${INFOBIP_BASE_URL}/sms/2/text/advanced`, data, {
      headers: {
        Authorization: `App ${INFOBIP_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    console.log("[Infobip SMS] Response:", res.data);
    return res.data;
  } catch (err) {
    if (err.response && err.response.data) {
      console.error("[Infobip SMS] Error:", err.response.data);
    } else {
      console.error("[Infobip SMS] Error:", err.message || err);
    }
    throw err;
  }
}

// For WhatsApp channel (template-based, adapt as needed)
export async function sendOTPWhatsAppWithInfobip(phone, otp) {
  const data = {
    messages: [
      {
        from: "447860099299", // Replace with your WhatsApp sender (your Infobip WABA number)
        to: phone,
        content: {
          templateName: "otp_template", // Must be pre-approved in your Infobip WhatsApp templates
          templateData: {
            body: {
              placeholders: [otp]
            }
          },
          language: "en"
        },
        channel: "WHATSAPP"
      }
    ]
  };

  try {
    const res = await axios.post(`${INFOBIP_BASE_URL}/whatsapp/1/message/template`, data, {
      headers: {
        Authorization: `App ${INFOBIP_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    console.log("[Infobip WhatsApp] Response:", res.data);
    return res.data;
  } catch (err) {
    if (err.response && err.response.data) {
      console.error("[Infobip WhatsApp] Error:", err.response.data);
    } else {
      console.error("[Infobip WhatsApp] Error:", err.message || err);
    }
    throw err;
  }
}
