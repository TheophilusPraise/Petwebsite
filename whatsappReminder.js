// whatsappReminder.js
import venom from 'venom-bot';
import pool from './config/db.js';

let venomClient = null;

export async function initWhatsAppReminder() {
  venomClient = await venom.create({ session: 'petcare-session', multidevice: true });
  startWhatsAppReminderScheduler();
  console.log('Venom WhatsApp client initialized for WhatsApp reminders');
}

function formatWhatsAppNumber(phone) {
  // Remove plus sign if present and append "@c.us"
  return phone.replace(/^\+/, '') + '@c.us';
}

async function startWhatsAppReminderScheduler() {
  setInterval(async () => {
    const now = new Date();
    // Compare only up to the minute (YYYY-MM-DDTHH:mm)
    const nowISO = now.toISOString().slice(0, 16);

    try {
      const [reminders] = await pool.query(
        `SELECT r.id, r.description, r.remind_at, r.sms_phone, u.name AS user_name, p.name AS pet_name
         FROM reminders r
         JOIN users u ON r.user_id = u.id
         JOIN pets p ON r.pet_id = p.id
         WHERE r.status='pending'
           AND DATE_FORMAT(r.remind_at, '%Y-%m-%dT%H:%i') = ?
           AND r.sms_phone IS NOT NULL
           AND r.send_sms = 1
        `,
        [nowISO]
      );

      for (const r of reminders) {
        const message = `PetCare Reminder for ${r.user_name}:\n${r.description} (${r.pet_name})`;
        const waNumber = formatWhatsAppNumber(r.sms_phone);

        try {
          await venomClient.sendText(waNumber, message);
          console.log(
            `WhatsApp reminder sent to ${r.sms_phone} at ${nowISO}: ${r.description}`
          );
          // Mark reminder as sent
          await pool.query('UPDATE reminders SET status="sent" WHERE id=?', [r.id]);
        } catch (err) {
          console.error(`Failed to send WhatsApp to ${waNumber}: ${err.message || err}`);
        }
      }
    } catch (err) {
      console.error('WhatsApp Reminder Cron Error:', err.message || err);
    }
  }, 60 * 1000); // Every minute
}
