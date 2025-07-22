import axios from 'axios';

export async function sendSmsOrWhatsapp({to, message, channel = 'whatsapp'}) {
  // Replace URL/headers/body for your chosen provider—see their documentation
  const url = channel === 'sms'
    ? 'https://api.sendchamp.com/api/v1/sms/send'
    : 'https://api.sendchamp.com/api/v1/whatsapp/message/send';

  const payload = { 
    to: to.replace(/^\+/, ''), // some APIs may require or remove '+'
    message,
    sender_name: 'PetCare'
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MSG_API_ID}`
      }
    });
    return res.data;
  } catch (err) {
    console.error('Failed to send message:', err?.response?.data || err.message);
    return null;
  }
}
