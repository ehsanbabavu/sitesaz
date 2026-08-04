import nodemailer from "nodemailer";
import { db } from "./db-storage";
import { sentMessages } from "../shared/schema";
import { storage } from "./email-sender-storage";
import fs from "fs";

interface AttachmentInput {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
}

interface SendResult {
  success: boolean;
  info?: any;
  error?: any;
}


export async function sendMail(userId: string, to: string, subject: string, text: string, attachments: AttachmentInput[] = []): Promise<SendResult> {
  try {
    const smtpHost = process.env.SMTP_HOST || "127.0.0.1";
    const smtpPort = parseInt(process.env.SMTP_PORT || "1025", 10);
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";

    // Fetch user to get sender email
    const user = await storage.getUser(userId);
    const smtpFrom = user?.email || process.env.SMTP_FROM || `no-reply@${smtpHost}`;

    const transportOptions: any = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
    };

    if (smtpUser && smtpPass) {
      transportOptions.auth = { user: smtpUser, pass: smtpPass };
    }

    // allow sending to local dev smtp servers without TLS
    transportOptions.tls = { rejectUnauthorized: false };

    const transporter = nodemailer.createTransport(transportOptions);

    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
      attachments: attachments.map((a) => {
        const out: any = { filename: a.filename };
        if (a.path) out.path = a.path;
        if (a.content) out.content = a.content;
        if (a.contentType) out.contentType = a.contentType;
        return out;
      }),
    });

    // record sent message in DB (best-effort)
    try {
      const attachmentNames = attachments.map(a => a.filename).join(", ");
      await db.insert(sentMessages).values({
        userId,
        recipient: to,
        message: `Subject: ${subject}\n\n${text}${attachmentNames ? `\n\nAttachments: ${attachmentNames}` : ''}`,
      });
    } catch (dbErr) {
      console.error("Error saving sent message to DB:", dbErr);
    }

    // Clean up uploaded attachment files from disk
    for (const a of attachments) {
      if (a.path) {
        fs.unlink(a.path, (err) => {
          if (err) console.error("Error deleting attachment file:", a.path, err);
        });
      }
    }

    return { success: true, info };
  } catch (error) {
    console.error("Error sending mail:", error);
    // Clean up files even on failure
    for (const a of attachments) {
      if (a.path) {
        fs.unlink(a.path, () => {});
      }
    }
    return { success: false, error: "خطا در ارسال ایمیل" };
  }
}

export default { sendMail };
