const nodemailer = require('nodemailer');

// Email service — uses Gmail SMTP by default (set EMAIL_USER and EMAIL_PASS in .env)
// Generate an "App Password" at https://myaccount.google.com/apppasswords if 2FA is on
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[email] EMAIL_USER / EMAIL_PASS not set — emails will be skipped.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const FROM_ADDRESS = process.env.EMAIL_FROM || `"Lifeline" <${process.env.EMAIL_USER}>`;

/**
 * Send an email. Returns true on success, false if email is not configured or fails.
 */
const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html });
    return true;
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return false;
  }
};

const passwordResetTemplate = (name, resetLink) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #fff7f7;">
    <div style="background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <h1 style="color: #c0392b; margin-top: 0;">Password Reset Request</h1>
      <p>Hi <strong>${name || 'there'}</strong>,</p>
      <p>We received a request to reset your Lifeline password. Click the button below to choose a new one. This link is valid for <strong>15 minutes</strong>.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="background: #c0392b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reset My Password
        </a>
      </p>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #555;">${resetLink}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>
  </div>
`;

const newDonationRequestTemplate = (donorName, requestDetails, link) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #eee;">
      <h2 style="color: #c0392b; margin-top: 0;">🩸 Urgent Blood Donation Request</h2>
      <p>Hi <strong>${donorName}</strong>,</p>
      <p>A new donation request matching your blood group was just created:</p>
      <ul>
        <li><strong>Patient:</strong> ${requestDetails.patientName}</li>
        <li><strong>Blood Group:</strong> ${requestDetails.bloodGroup}</li>
        <li><strong>Hospital:</strong> ${requestDetails.hospitalName}</li>
        <li><strong>Location:</strong> ${requestDetails.district}, ${requestDetails.upazila}</li>
        <li><strong>Date:</strong> ${requestDetails.donationDate}</li>
      </ul>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${link}" style="background: #c0392b; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          View Request
        </a>
      </p>
      <p style="color: #888; font-size: 13px;">You are receiving this because your profile blood group matches.</p>
    </div>
  </div>
`;

const donationStatusTemplate = (recipientName, status, link) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #c0392b;">Donation Request Update</h2>
    <p>Hi <strong>${recipientName}</strong>,</p>
    <p>Your donation request status has been updated to: <strong style="color: #c0392b;">${status.toUpperCase()}</strong>.</p>
    <p><a href="${link}" style="color: #c0392b;">View details →</a></p>
  </div>
`;

module.exports = {
  sendEmail,
  passwordResetTemplate,
  newDonationRequestTemplate,
  donationStatusTemplate,
};
