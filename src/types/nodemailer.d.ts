declare module 'nodemailer' {
  import { EventEmitter } from 'events';
  interface SendMailOptions {
    from?: string;
    to?: string | string[];
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename?: string; content?: any; path?: string }>;
  }
  interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    envelope?: Record<string, any>;
    response?: string;
  }
  interface Transporter {
    sendMail(mailOptions: SendMailOptions): Promise<SentMessageInfo>;
  }
  function createTransport(options: Record<string, any>): Transporter;
  export { createTransport, Transporter, SendMailOptions, SentMessageInfo };
}
