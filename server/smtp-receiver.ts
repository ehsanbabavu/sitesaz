import { db } from "./db-storage";
import { receivedMessages } from "../shared/schema";
import { nanoid } from "nanoid";

interface SMTPMessage {
  userId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}

export class SMTPReceiver {
  async saveEmail(message: SMTPMessage) {
    try {
      await db.insert(receivedMessages).values({
        userId: message.userId,
        whatsiPlusId: `smtp_${nanoid()}`,
        sender: message.from,
        message: `موضوع: ${message.subject}\n\n${message.text}`,
        status: "خوانده نشده",
        timestamp: new Date(),
      });

      console.log(`📧 ایمیل دریافت شد: ${message.from} -> ${message.to}`);
      return true;
    } catch (error) {
      console.error("خطا در ذخیره ایمیل:", error);
      return false;
    }
  }
}

export const smtpReceiver = new SMTPReceiver();
