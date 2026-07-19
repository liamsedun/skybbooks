import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `;

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const { Resend } = await import('resend');
      const resend = new Resend(apiKey);
      const fromEmail = process.env.FROM_EMAIL || 'delivered@resend.dev';
      await resend.emails.send({
        from: `SkyBooks Contact <${fromEmail}>`,
        to: 'hello@skyaccounting.com.ng',
        replyTo: email,
        subject: `[Contact] ${subject || 'New Message'} from ${name}`,
        html,
      });
    } else {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: `"${name}" <${process.env.SMTP_USER || email}>`,
        to: 'hello@skyaccounting.com.ng',
        replyTo: email,
        subject: `[Contact] ${subject || 'New Message'} from ${name}`,
        html,
      });
    }

    return res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err: any) {
    console.error('[Contact] Failed to send:', err);
    return res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
});

export default router;
