const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Create secure transport channel configuration
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // TLS require explicitly 587
    auth: {
      user: process.env.EMAIL_USER.trim(),
      pass: process.env.EMAIL_PASS.trim()
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    }
  });

  // 2. Setup the HTML envelope payload
  const mailOptions = {
    from: `"MHT-CET Suite" <${process.env.EMAIL_USER.trim()}>`,
    to: options.email.trim(),
    subject: options.subject,
    html: `
      <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; max-width: 500px; margin: auto; border: 1px solid #334155;">
        <h2 style="color: #6366f1; text-align: center; font-weight: 900; letter-spacing: -0.5px;">MHT-CET PORTAL ACTIVATION</h2>
        <p style="font-size: 14px; text-align: center; color: #94a3b8;">Secure your counselling simulation registry space.</p>
        <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #34d399; letter-spacing: 6px;">${options.otp}</span>
        </div>
        <p style="font-size: 11px; text-align: center; color: #64748b;">This OTP configuration is tightly isolated and will strictly expire in 10 minutes.</p>
      </div>
    `
  };

  // 3. Trigger dispatch actions
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;