import nodemailer from 'nodemailer';
import { config } from './config.js';

let transport = null;
if (config.smtp.host) {
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendMail({ to, subject, text, html, replyTo }) {
  if (!transport) {
    console.log(`\n[mail] (SMTP not configured — printing instead)\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: config.smtp.from, to, subject, text, html, replyTo });
}

export async function sendPasswordResetEmail(user, link) {
  const name = user.full_name || user.username;
  await sendMail({
    to: user.email,
    subject: 'Reset your Health Synapsis password',
    text: `Hello ${name},\n\nWe received a request to reset the password for your Health Synapsis account (${user.username}).\n\nSet a new password here (valid for 1 hour):\n${link}\n\nIf you did not request this, you can ignore this email; your password will not change.\n`,
    html: `<p>Hello ${esc(name)},</p>
<p>We received a request to reset the password for your Health Synapsis account (<b>${esc(user.username)}</b>).</p>
<p><a href="${esc(link)}" style="display:inline-block;padding:10px 18px;background:#1d4a44;color:#fff;border-radius:8px;text-decoration:none">Set a new password</a></p>
<p style="color:#666;font-size:13px">This link is valid for 1 hour. If you did not request this, ignore this email; your password will not change.</p>`,
  });
}

export async function sendContactNotification(msg) {
  if (!config.contactTo) return;
  await sendMail({
    to: config.contactTo,
    replyTo: msg.email || undefined,
    subject: `Website message: ${msg.subject || 'New enquiry'} — ${msg.name}`,
    text: `From: ${msg.name}\nEmail: ${msg.email || '-'}\nPhone: ${msg.phone || '-'}\n\n${msg.message}\n`,
  });
}
