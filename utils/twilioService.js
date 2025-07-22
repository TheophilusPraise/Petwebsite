import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE; // See note below

const client = twilio(accountSid, authToken);

// Use this function to send OTP SMS
export async function sendOTPSMSWithTwilio(to, otp) {
  const dest = to.startsWith('+') ? to : `+${to}`;
  try {
    const message = await client.messages.create({
      body: `Your PetCare verification code is: ${otp}`,
      from: twilioPhone,           // IMPORTANT: For Nigeria, from should be your approved alphanumeric Sender ID, not a phone number
      to: dest,
    });
    console.log("Twilio SMS SID:", message.sid, "Status:", message.status);
    return message;
  } catch (err) {
    console.error("Twilio error:", err);
    throw err;
  }
}
