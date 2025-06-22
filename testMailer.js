import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { sendOTPEmail } from './utils/mailer.js';

(async () => {
  try {
    console.log('Sending test email...');
    await sendOTPEmail('oyeniyitheophilus2@gmail.com', '123456');
    console.log('Test email sent successfully!');
  } catch (error) {
    console.error('Email test failed:', error);
  }
})();
