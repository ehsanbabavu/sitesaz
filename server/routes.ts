import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { insertUserSchema, insertSubUserSchema, insertTicketSchema, insertSubscriptionSchema, insertProductSchema, insertWhatsappSettingsSchema, insertSentMessageSchema, insertReceivedMessageSchema, insertAiTokenSettingsSchema, insertBlockchainSettingsSchema, insertUserSubscriptionSchema, insertCategorySchema, insertCartItemSchema, insertAddressSchema, updateAddressSchema, insertOrderSchema, insertOrderItemSchema, insertTransactionSchema, updateCategoryOrderSchema, ticketReplySchema, insertInternalChatSchema, insertFaqSchema, updateFaqSchema, maintenanceMode, type User, cryptoTransactions, emails, users, receivedMessages, sentMessages } from "@shared/schema";
import { z } from "zod";
import fs from "fs";
import { generateAndSaveInvoice } from "./invoice-service";
import { whatsAppSender } from "./whatsapp-sender";
import { db, eq } from "./db-storage";
import { and, desc } from "drizzle-orm";
import { orders } from "@shared/schema";
import { tronService } from "./tron-service";
import { rippleService } from "./ripple-service";
import { cardanoService } from "./cardano-service";
import { tgjuService } from "./tgju-service";
import { cryptoPriceCacheService } from "./crypto-price-cache-service";
import { cryptoMatchingService } from "./crypto-matching-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT secret initialization
import crypto from 'crypto';

let jwtSecret: string;
if (process.env.JWT_SECRET) {
  jwtSecret = process.env.JWT_SECRET;
} else {
  if (process.env.NODE_ENV === 'production') {
    console.error("🛑 JWT_SECRET environment variable is required in production!");
    console.error("💡 Set JWT_SECRET to a random 32+ character string");
    process.exit(1);
  } else {
    console.warn("🔧 DEV MODE: Using fixed JWT secret for development - set JWT_SECRET env var for production");
    // Use a fixed secret in development to prevent token invalidation on restart
    jwtSecret = 'dev_jwt_secret_key_replit_persian_ecommerce_2024_fixed_for_development';
  }
}

// Multer configuration for file uploads
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads");
    // اطمینان از وجود فولدر uploads
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage_config,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع فایل مجاز نیست"));
    }
  },
});

// Multer for email attachments (allow common types, larger size)
const emailUpload = multer({
  storage: storage_config,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req: any, file: any, cb: any) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/zip",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(null, true); // allow unknown types too (best-effort)
  },
});

// Multer configuration for WhatsApp chat images
const whatsapp_storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "UploadsPicClienet");
    // اطمینان از وجود فولدر UploadsPicClienet
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadWhatsApp = multer({
  storage: whatsapp_storage_config,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع فایل مجاز نیست"));
    }
  },
});

// Multer configuration for stamp images (مهر و امضا)
const stamp_storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "stamppic");
    // اطمینان از وجود فولدر stamppic
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadStamp = multer({
  storage: stamp_storage_config,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع فایل مجاز نیست"));
    }
  },
});

// Auth middleware  
interface AuthRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "توکن احراز هویت مورد نیاز است" });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "کاربر یافت نشد" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: "توکن نامعتبر است" });
  }
};

// Admin middleware
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "دسترسی مدیر مورد نیاز است" });
  }
  next();
};

// Middleware for category operations - allows admin and user_level_1
const requireAdminOrUserLevel1 = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin" && req.user?.role !== "user_level_1") {
    return res.status(403).json({ message: "دسترسی مدیر یا کاربر سطح ۱ مورد نیاز است" });
  }
  next();
};

// Admin or Level 1 user middleware for WhatsApp access
const requireAdminOrLevel1 = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin" && req.user?.role !== "user_level_1") {
    return res.status(403).json({ message: "دسترسی مدیر یا کاربر سطح ۱ مورد نیاز است" });
  }
  next();
};

// Helper functions for conversation thread management
interface ConversationMessage {
  id: string;
  message: string;
  createdAt: string;
  isAdmin: boolean;
  userName: string;
}

const parseConversationThread = (adminReply: string | null): ConversationMessage[] => {
  if (!adminReply) return [];
  
  try {
    // Try to parse as JSON array (new format)
    const parsed = JSON.parse(adminReply);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // If it's not an array, treat as legacy single response
    return [{
      id: `legacy_${Date.now()}`,
      message: adminReply,
      createdAt: new Date().toISOString(),
      isAdmin: true,
      userName: 'پشتیبانی'
    }];
  } catch {
    // If parsing fails, treat as legacy single response
    return [{
      id: `legacy_${Date.now()}`,
      message: adminReply,
      createdAt: new Date().toISOString(),
      isAdmin: true,
      userName: 'پشتیبانی'
    }];
  }
};

const addMessageToThread = (
  existingThread: ConversationMessage[], 
  message: string,
  isAdmin: boolean,
  userName: string
): ConversationMessage[] => {
  const newMessage: ConversationMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    message: message.trim(),
    createdAt: new Date().toISOString(),
    isAdmin,
    userName
  };
  
  return [...existingThread, newMessage];
};

const serializeConversationThread = (thread: ConversationMessage[]): string => {
  return JSON.stringify(thread);
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Rate limiting map for password reset requests (username -> {count, resetTime})
  const passwordResetAttempts = new Map<string, { count: number; resetTime: number }>();
  
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Generate username from phone number
      let username = req.body.username;
      if (!username && req.body.phone) {
        // نرمال‌سازی شماره تلفن و استفاده به عنوان نام کاربری
        const phone = req.body.phone.trim();
        username = phone.startsWith('98') 
          ? '0' + phone.substring(2) 
          : (phone.startsWith('0') ? phone : '0' + phone);
      } else if (!username && req.body.email) {
        // اگر شماره نبود از ایمیل استفاده کن
        username = req.body.email.split('@')[0] + Math.random().toString(36).substr(2, 4);
      }

      if (!username) {
        return res.status(400).json({ message: "نام کاربری یا شماره تلفن برای ثبت‌نام الزامی است" });
      }

      // Check if username or phone already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        // اگر نام کاربری (شماره تلفن) تکراری بود، پسوند تصادفی اضافه کن یا خطا بده
        return res.status(400).json({ message: "این شماره تلفن قبلاً در سیستم ثبت شده است" });
      }

      const userData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        username: username,
        phone: req.body.phone,
        password: req.body.password,
        role: req.body.role || "user_level_1",
        email: req.body.email || undefined,
        whatsappNumber: req.body.whatsappNumber || req.body.phone
      };
      
      const validatedData = insertUserSchema.parse(userData);
      
      // Check if user already exists (if email is provided)
      if (validatedData.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser) {
          return res.status(400).json({ message: "کاربری با این ایمیل قبلاً ثبت نام کرده است" });
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(normalizeDigits(validatedData.password || '123456'), 10);
      
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      // Create 7-day free trial subscription for new users
      try {
        // Find the default free subscription plan
        let trialSubscription = (await storage.getAllSubscriptions()).find(sub => 
          sub.isDefault === true
        );

        // If no default subscription exists, this should not happen
        // The system should have created a default subscription during initialization
        if (!trialSubscription) {
          console.warn("⚠️ Default subscription not found - this should not happen");
          console.warn("Continuing without creating subscription for user:", user.id);
        } else {
          // Create user subscription for 7-day trial
          await storage.createUserSubscription({
            userId: user.id,
            subscriptionId: trialSubscription.id,
            remainingDays: 7,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            status: "active",
            isTrialPeriod: true,
          });
          console.log("✅ Created 7-day trial subscription for registered user:", user.id);
        }
      } catch (trialError) {
        console.error("خطا در ایجاد اشتراک آزمایشی:", trialError);
        // Don't fail user registration if trial subscription creation fails
      }

      // ارسال اعلان به مدیر برای کاربر جدید
      try {
        const whatsappSettings = await storage.getWhatsappSettings();
        if (whatsappSettings?.notifications?.includes('new_user') && whatsappSettings.isEnabled && whatsappSettings.token) {
          const adminUser = await storage.getUserByUsername("ehsan");
          if (adminUser && adminUser.phone) {
            const message = `👤 کاربر جدید ثبت‌نام کرد\n\nنام: ${user.firstName} ${user.lastName}\nنام کاربری: ${user.username}\nشماره: ${user.phone}`;
            await whatsAppSender.sendMessage(adminUser.phone, message, adminUser.id);
          }
        }
      } catch (notificationError) {
        console.error("خطا در ارسال اعلان کاربر جدید:", notificationError);
      }

      // Generate JWT
      const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });

      res.json({ 
        user: { ...user, password: undefined },
        token 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ثبت نام کاربر" });
    }
  });

  // Helper function to normalize Persian/Arabic digits to ASCII
  const normalizeDigits = (text: string): string => {
    return text
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()) // Persian digits
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()) // Arabic digits
      .trim();
  };

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Normalize identifier and password to handle Persian/Arabic digits
      const normalizedIdentifier = normalizeDigits(email || '');
      const normalizedPassword = normalizeDigits(password || '');
      
      const user = await storage.getUserByEmailOrUsername(normalizedIdentifier);
      if (!user || !user.password) {
        return res.status(401).json({ message: "نام کاربری/ایمیل یا رمز عبور اشتباه است" });
      }

      const isValidPassword = await bcrypt.compare(normalizedPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "نام کاربری/ایمیل یا رمز عبور اشتباه است" });
      }

      const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });

      // ثبت لاگ ورود کاربر
      try {
        // دریافت IP واقعی کاربر - ابتدا هدرهای پروکسی را چک می‌کنیم
        // x-forwarded-for ممکن است شامل چند IP باشد (client, proxy1, proxy2, ...)
        // اولین IP همیشه IP واقعی کاربر است
        const forwardedFor = req.headers['x-forwarded-for'];
        const ipAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]?.trim()) ||
                         req.headers['x-real-ip'] as string ||
                         req.ip ||
                         req.socket.remoteAddress ||
                         'unknown';
        
        // دریافت User Agent
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        await storage.createLoginLog({
          userId: user.id,
          username: user.username,
          ipAddress: ipAddress.toString(),
          userAgent: userAgent,
        });
      } catch (logError) {
        // اگر ثبت لاگ با خطا مواجه شد، فقط لاگ کنیم و ادامه بدیم
        console.error("Error creating login log:", logError);
      }

      res.json({ 
        user: { ...user, password: undefined },
        token 
      });
    } catch (error) {
      res.status(500).json({ message: "خطا در ورود کاربر" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    res.json({ user: { ...req.user!, password: undefined } });
  });

  // Password reset routes
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "نام کاربری الزامی است" });
      }

      // Rate limiting: محدودیت 3 درخواست در 15 دقیقه برای هر کاربر
      const now = Date.now();
      const userAttempts = passwordResetAttempts.get(username);
      
      if (userAttempts) {
        if (now - userAttempts.resetTime < 15 * 60 * 1000) {
          if (userAttempts.count >= 3) {
            return res.status(429).json({ message: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً 15 دقیقه دیگر تلاش کنید" });
          }
          userAttempts.count++;
        } else {
          // Reset counter after 15 minutes
          passwordResetAttempts.set(username, { count: 1, resetTime: now });
        }
      } else {
        passwordResetAttempts.set(username, { count: 1, resetTime: now });
      }

      // پیدا کردن کاربر
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        // برای امنیت، پیام یکسانی برمی‌گردانیم حتی اگر کاربر وجود نداشته باشد
        return res.json({ message: "اگر کاربری با این نام کاربری وجود داشته باشد، کد بازیابی به واتس‌اپ ارسال می‌شود" });
      }

      // بررسی وجود شماره واتس‌اپ
      if (!user.whatsappNumber) {
        return res.status(400).json({ message: "شماره واتس‌اپ برای این کاربر ثبت نشده است" });
      }

      // تولید کد 6 رقمی امن با crypto
      const crypto = await import("crypto");
      const otp = crypto.randomInt(100000, 1000000).toString();
      
      // تاریخ انقضا (5 دقیقه)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      
      // ذخیره OTP در دیتابیس
      await storage.createPasswordResetOtp(user.id, otp, expiresAt);
      
      // ارسال کد به واتس‌اپ
      const whatsAppSender = (await import("./whatsapp-sender")).whatsAppSender;
      const message = `کد بازیابی رمز عبور شما: ${otp}\n\nاین کد تا 5 دقیقه دیگر معتبر است.`;
      
      // دریافت تنظیمات واتس‌اپ مدیر برای ارسال
      const adminSettings = await storage.getWhatsappSettings();
      
      if (!adminSettings || !adminSettings.token || !adminSettings.isEnabled) {
        return res.status(400).json({ message: "سرویس ارسال پیام واتس‌اپ فعال نیست" });
      }
      
      const sent = await whatsAppSender.sendMessage(user.whatsappNumber, message, user.id);
      
      if (!sent) {
        return res.status(500).json({ message: "خطا در ارسال کد به واتس‌اپ" });
      }
      
      res.json({ message: "کد بازیابی به شماره واتس‌اپ شما ارسال شد" });
    } catch (error) {
      console.error("Error in password reset request:", error);
      res.status(500).json({ message: "خطا در درخواست بازیابی رمز عبور" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { username, otp, newPassword } = req.body;
      
      if (!username || !otp || !newPassword) {
        return res.status(400).json({ message: "تمام فیلدها الزامی هستند" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "رمز عبور باید حداقل 6 کاراکتر باشد" });
      }

      // پیدا کردن کاربر
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      // بررسی معتبر بودن OTP
      const validOtp = await storage.getValidPasswordResetOtp(user.id, otp);
      
      if (!validOtp) {
        return res.status(400).json({ message: "کد نامعتبر یا منقضی شده است" });
      }

      // هش کردن رمز عبور جدید
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // بروزرسانی رمز عبور
      await storage.updateUserPassword(user.id, hashedPassword);
      
      // علامت‌گذاری OTP به عنوان استفاده شده
      await storage.markOtpAsUsed(validOtp.id);
      
      res.json({ message: "رمز عبور با موفقیت تغییر کرد" });
    } catch (error) {
      console.error("Error in password reset:", error);
      res.status(500).json({ message: "خطا در تغییر رمز عبور" });
    }
  });

  // User management routes (Admin only)
  app.get("/api/users", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Get users visible to current user based on their role
      const users = await storage.getUsersVisibleToUser(req.user!.id, req.user!.role);
      
      // Get subscription data for each user
      const usersWithSubscriptions = await Promise.all(
        users.map(async (user) => {
          try {
            // Get user's active subscription
            const userSubscription = await storage.getUserSubscription(user.id);
            
            let subscriptionInfo = null;
            if (userSubscription) {
              // Get subscription details
              const subscription = await storage.getSubscription(userSubscription.subscriptionId);
              subscriptionInfo = {
                name: subscription?.name || 'نامشخص',
                remainingDays: userSubscription.remainingDays,
                status: userSubscription.status,
                isTrialPeriod: userSubscription.isTrialPeriod
              };
            }
            
            return {
              ...user,
              password: undefined,
              subscription: subscriptionInfo
            };
          } catch (error) {
            // If there's an error getting subscription data, return user without subscription
            return {
              ...user,
              password: undefined,
              subscription: null
            };
          }
        })
      );
      
      res.json(usersWithSubscriptions);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت کاربران" });
    }
  });

  app.post("/api/users", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists (if email is provided)
      if (validatedData.email) {
        const existingEmailUser = await storage.getUserByEmail(validatedData.email);
        if (existingEmailUser) {
          return res.status(400).json({ message: "کاربری با این ایمیل قبلاً ثبت نام کرده است" });
        }
      }

      const existingUsernameUser = await storage.getUserByUsername(validatedData.username!);
      if (existingUsernameUser) {
        return res.status(400).json({ message: "کاربری با این نام کاربری قبلاً ثبت نام کرده است" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(normalizeDigits(validatedData.password || '123456'), 10);
      
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      // Create 7-day free trial subscription for new users created by admin
      try {
        // Find the default free subscription plan
        let trialSubscription = (await storage.getAllSubscriptions()).find(sub => 
          sub.isDefault === true
        );

        // If no default subscription exists, this should not happen
        // The system should have created a default subscription during initialization
        if (!trialSubscription) {
          console.warn("⚠️ Default subscription not found - this should not happen");
          console.warn("Continuing without creating subscription for user:", user.id);
        } else {
          // Create user subscription for 7-day trial
          await storage.createUserSubscription({
            userId: user.id,
            subscriptionId: trialSubscription.id,
            remainingDays: 7,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            status: "active",
            isTrialPeriod: true,
          });
          console.log("✅ Created 7-day trial subscription for admin-created user:", user.id);
        }
      } catch (trialError) {
        console.error("خطا در ایجاد اشتراک آزمایشی:", trialError);
        // Don't fail user creation if trial subscription creation fails
      }

      res.json({ ...user, password: undefined });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ایجاد کاربر" });
    }
  });

  // Update bank card info for level 1 users
  // IMPORTANT: This route must come BEFORE /api/users/:id to avoid Express matching "bank-card" as :id
  app.put("/api/users/bank-card", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { bankCardNumber, bankCardHolderName } = req.body;

      if (!bankCardNumber || !bankCardHolderName) {
        return res.status(400).json({ message: "شماره کارت و نام صاحب کارت الزامی است" });
      }

      // Validate card number (16 digits)
      const cardNumberRegex = /^\d{16}$/;
      if (!cardNumberRegex.test(bankCardNumber.replace(/\s/g, ''))) {
        return res.status(400).json({ message: "شماره کارت باید 16 رقم باشد" });
      }

      const updatedUser = await storage.updateUser(req.user!.id, {
        bankCardNumber: bankCardNumber.replace(/\s/g, ''),
        bankCardHolderName,
        bankCardApprovalStatus: 'pending',
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "خطا در بروزرسانی اطلاعات کارت بانکی" });
      }

      res.json({
        message: "اطلاعات کارت بانکی با موفقیت بروزرسانی شد",
        bankCardNumber: updatedUser.bankCardNumber,
        bankCardHolderName: updatedUser.bankCardHolderName,
      });
    } catch (error) {
      console.error("خطا در بروزرسانی کارت بانکی:", error);
      res.status(500).json({ message: "خطا در بروزرسانی کارت بانکی" });
    }
  });

  app.put("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "خطا در بروزرسانی کاربر" });
    }
  });

  // Admin: Get all level 1 users with bank cards for approval
  app.get("/api/admin/bank-cards", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      const level1UsersWithCards = users
        .filter(user => user.role === 'user_level_1' && user.bankCardNumber)
        .map(user => ({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          bankCardNumber: user.bankCardNumber,
          bankCardHolderName: user.bankCardHolderName,
          bankCardApprovalStatus: user.bankCardApprovalStatus || 'pending',
          createdAt: user.createdAt,
        }));

      res.json(level1UsersWithCards);
    } catch (error) {
      console.error("خطا در دریافت کارت‌های بانکی:", error);
      res.status(500).json({ message: "خطا در دریافت کارت‌های بانکی" });
    }
  });

  // Admin: Approve or reject bank card
  app.put("/api/admin/bank-cards/:userId/approval", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body; // 'approved' or 'rejected'

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "وضعیت نامعتبر است" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      if (user.role !== 'user_level_1') {
        return res.status(400).json({ message: "فقط کاربران سطح 1 می‌توانند کارت بانکی داشته باشند" });
      }

      const updatedUser = await storage.updateUser(userId, {
        bankCardApprovalStatus: status,
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "خطا در بروزرسانی وضعیت تایید" });
      }

      console.log(`✅ کارت بانکی کاربر ${user.username} توسط مدیر ${status === 'approved' ? 'تایید' : 'رد'} شد`);
      
      res.json({
        message: `کارت بانکی با موفقیت ${status === 'approved' ? 'تایید' : 'رد'} شد`,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          bankCardApprovalStatus: updatedUser.bankCardApprovalStatus,
        }
      });
    } catch (error) {
      console.error("خطا در بروزرسانی وضعیت تایید:", error);
      res.status(500).json({ message: "خطا در بروزرسانی وضعیت تایید" });
    }
  });

  // Get parent user bank card info (for level 2 users during payment)
  app.get("/api/parent-user-bank-card", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;

      if (currentUser.role !== 'user_level_2') {
        return res.status(403).json({ message: "دسترسی غیرمجاز. این اندپوینت فقط برای کاربران سطح 2 است." });
      }

      if (!currentUser.parentUserId) {
        return res.status(404).json({ message: "کاربر والد یافت نشد" });
      }

      const parentUser = await storage.getUser(currentUser.parentUserId);

      if (!parentUser) {
        return res.status(404).json({ message: "کاربر والد یافت نشد" });
      }

      res.json({
        bankCardNumber: parentUser.bankCardNumber || null,
        bankCardHolderName: parentUser.bankCardHolderName || null,
        sellerId: parentUser.id,
        sellerName: `${parentUser.firstName} ${parentUser.lastName}`,
      });
    } catch (error) {
      console.error("خطا در دریافت اطلاعات کارت بانکی والد:", error);
      res.status(500).json({ message: "خطا در دریافت اطلاعات کارت بانکی" });
    }
  });

  // Admin-only route to update WhatsApp token for users
  app.put("/api/admin/users/:userId/whatsapp-token", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { whatsappToken } = req.body;

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      // Update only the whatsappToken field
      const updatedUser = await storage.updateUser(userId, { whatsappToken });
      if (!updatedUser) {
        return res.status(500).json({ message: "خطا در بروزرسانی توکن" });
      }

      console.log(`✅ توکن واتس‌اپ کاربر ${user.username} توسط مدیر بروزرسانی شد`);
      res.json({ 
        message: "توکن واتس‌اپ با موفقیت بروزرسانی شد",
        user: { ...updatedUser, password: undefined }
      });
    } catch (error) {
      console.error("خطا در بروزرسانی توکن واتس‌اپ:", error);
      res.status(500).json({ message: "خطا در بروزرسانی توکن واتس‌اپ" });
    }
  });

  app.delete("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      // Delete user subscriptions (to avoid foreign key constraint)
      const userSubscriptions = await storage.getUserSubscriptionsByUserId(id);
      for (const subscription of userSubscriptions) {
        await storage.deleteUserSubscription(subscription.id);
      }

      // Delete user tickets (if any)
      const userTickets = await storage.getTicketsByUser(id);
      for (const ticket of userTickets) {
        await storage.deleteTicket(ticket.id);
      }

      // Delete user products (if any)
      const userProducts = await storage.getProductsByUser(id);
      for (const product of userProducts) {
        await storage.deleteProduct(product.id, id, user.role);
      }

      // Delete user addresses
      const userAddresses = await storage.getAddressesByUser(id);
      for (const address of userAddresses) {
        await storage.deleteAddress(address.id, id);
      }

      // Note: Other related data (messages, chats, transactions, OTPs, shipping settings)
      // will be handled by database CASCADE delete constraints

      // Finally delete the user
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(500).json({ message: "خطا در حذف کاربر" });
      }

      res.json({ message: "کاربر و تمام اطلاعات مربوطه با موفقیت حذف شد" });
    } catch (error) {
      console.error("خطا در حذف کاربر:", error);
      res.status(500).json({ message: "خطا در حذف کاربر" });
    }
  });

  // Login Logs Management Routes (Admin only)
  app.get("/api/admin/login-logs", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const result = await storage.getLoginLogs(page, limit);
      res.json(result);
    } catch (error) {
      console.error("خطا در دریافت لاگ‌های ورود:", error);
      res.status(500).json({ message: "خطا در دریافت لاگ‌های ورود" });
    }
  });

  // Sub-user management routes (For user_level_1 to manage their sub-users)
  app.get("/api/sub-users", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only level 1 users can manage sub-users
      if (req.user?.role !== "user_level_1") {
        return res.status(403).json({ message: "فقط کاربران سطح ۱ می‌توانند زیرمجموعه‌ها را مدیریت کنند" });
      }

      const subUsers = await storage.getSubUsers(req.user.id);
      
      // Get subscription data for each sub-user
      const subUsersWithSubscriptions = await Promise.all(
        subUsers.map(async (user) => {
          try {
            const userSubscription = await storage.getUserSubscription(user.id);
            let subscriptionInfo = null;
            if (userSubscription) {
              const subscription = await storage.getSubscription(userSubscription.subscriptionId);
              subscriptionInfo = {
                name: subscription?.name || 'نامشخص',
                remainingDays: userSubscription.remainingDays,
                status: userSubscription.status,
                isTrialPeriod: userSubscription.isTrialPeriod
              };
            }
            
            return {
              ...user,
              password: undefined,
              subscription: subscriptionInfo
            };
          } catch (error) {
            return {
              ...user,
              password: undefined,
              subscription: null
            };
          }
        })
      );
      
      res.json(subUsersWithSubscriptions);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت زیرمجموعه‌ها" });
    }
  });

  app.post("/api/sub-users", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only level 1 users can create sub-users
      if (req.user?.role !== "user_level_1") {
        return res.status(403).json({ message: "فقط کاربران سطح ۱ می‌توانند زیرمجموعه ایجاد کنند" });
      }

      const validatedData = insertSubUserSchema.parse(req.body);
      
      // Generate username from phone number using the specified algorithm
      // Algorithm: Remove "98" prefix from phone number, then add "0" at the beginning
      const generateUsernameFromPhone = (phone: string): string => {
        if (!phone) throw new Error("شماره تلفن الزامی است");
        
        // Remove all spaces and non-digit characters, then normalize Persian/Arabic digits to English
        let cleanPhone = phone
          .replace(/\s+/g, '') // Remove spaces
          .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()) // Persian digits
          .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()) // Arabic digits
          .replace(/[^0-9]/g, ''); // Remove all non-digit characters
        
        // Handle different phone number formats
        if (cleanPhone.startsWith('+98')) {
          cleanPhone = cleanPhone.slice(3);
        } else if (cleanPhone.startsWith('0098')) {
          cleanPhone = cleanPhone.slice(4);
        } else if (cleanPhone.startsWith('98') && cleanPhone.length > 10) {
          cleanPhone = cleanPhone.slice(2);
        } else if (cleanPhone.startsWith('0')) {
          // Already in local format (0912...), keep as is
          return cleanPhone;
        }
        
        // Add "0" at the beginning for international numbers converted to local format
        return '0' + cleanPhone;
      };

      const generatedUsername = generateUsernameFromPhone(validatedData.phone);
      
      // Force role to be user_level_2 and set parent
      const subUserData = {
        ...validatedData,
        username: generatedUsername, // Use generated username instead of manual input
        role: "user_level_2",
        parentUserId: req.user.id,
      };
      
      // Check if user already exists (only if email is provided)
      if (subUserData.email) {
        const existingEmailUser = await storage.getUserByEmail(subUserData.email);
        if (existingEmailUser) {
          return res.status(400).json({ message: "کاربری با این ایمیل قبلاً ثبت نام کرده است" });
        }
      }

      const existingUsernameUser = await storage.getUserByUsername(subUserData.username);
      if (existingUsernameUser) {
        return res.status(400).json({ message: "کاربری با این شماره تلفن قبلاً ثبت نام کرده است" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(subUserData.password!, 10);
      
      // Ensure email is set to null if not provided
      const finalSubUserData = {
        ...subUserData,
        email: subUserData.email || `temp_${Date.now()}@level2.local`,
        password: hashedPassword,
      };
      
      const subUser = await storage.createUser(finalSubUserData);

      // Create 7-day free trial subscription for new sub-user
      try {
        let trialSubscription = (await storage.getAllSubscriptions()).find(sub => 
          sub.isDefault === true
        );

        if (trialSubscription) {
          await storage.createUserSubscription({
            userId: subUser.id,
            subscriptionId: trialSubscription.id,
            remainingDays: 7,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: "active",
            isTrialPeriod: true,
          });
        }
      } catch (trialError) {
        console.error("خطا در ایجاد اشتراک آزمایشی برای زیرمجموعه:", trialError);
      }

      res.json({ ...subUser, password: undefined });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ایجاد زیرمجموعه" });
    }
  });

  app.put("/api/sub-users/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only level 1 users can update their sub-users
      if (req.user?.role !== "user_level_1") {
        return res.status(403).json({ message: "فقط کاربران سطح ۱ می‌توانند زیرمجموعه‌ها را ویرایش کنند" });
      }

      const { id } = req.params;
      const updates = req.body;
      
      // Check if the sub-user belongs to this level 1 user
      const existingSubUser = await storage.getUser(id);
      if (!existingSubUser || existingSubUser.parentUserId !== req.user.id) {
        return res.status(404).json({ message: "زیرمجموعه یافت نشد یا متعلق به شما نیست" });
      }
      
      // Don't allow changing role or parentUserId
      const { role, parentUserId, ...allowedUpdates } = updates;
      
      const user = await storage.updateUser(id, allowedUpdates);
      if (!user) {
        return res.status(404).json({ message: "زیرمجموعه یافت نشد" });
      }

      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "خطا در بروزرسانی زیرمجموعه" });
    }
  });

  app.delete("/api/sub-users/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only level 1 users can delete their sub-users
      if (req.user?.role !== "user_level_1") {
        return res.status(403).json({ message: "فقط کاربران سطح ۱ می‌توانند زیرمجموعه‌ها را حذف کنند" });
      }

      const { id } = req.params;
      
      // Check if the sub-user belongs to this level 1 user
      const existingSubUser = await storage.getUser(id);
      if (!existingSubUser || existingSubUser.parentUserId !== req.user.id) {
        return res.status(404).json({ message: "زیرمجموعه یافت نشد یا متعلق به شما نیست" });
      }

      // Delete user subscriptions
      const userSubscriptions = await storage.getUserSubscriptionsByUserId(id);
      for (const subscription of userSubscriptions) {
        await storage.deleteUserSubscription(subscription.id);
      }

      // Delete user tickets
      const userTickets = await storage.getTicketsByUser(id);
      for (const ticket of userTickets) {
        await storage.deleteTicket(ticket.id);
      }

      // Delete user products
      const userProducts = await storage.getProductsByUser(id);
      for (const product of userProducts) {
        await storage.deleteProduct(product.id, req.user.id, req.user.role);
      }

      // Finally delete the sub-user
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(500).json({ message: "خطا در حذف زیرمجموعه" });
      }

      res.json({ message: "زیرمجموعه و تمام اطلاعات مربوطه با موفقیت حذف شد" });
    } catch (error) {
      console.error("خطا در حذف زیرمجموعه:", error);
      res.status(500).json({ message: "خطا در حذف زیرمجموعه" });
    }
  });

  // Reset password endpoint for sub-users
  app.post("/api/sub-users/:id/reset-password", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only level 1 users can reset password for their sub-users
      if (req.user?.role !== "user_level_1") {
        return res.status(403).json({ message: "فقط کاربران سطح ۱ می‌توانند رمز عبور زیرمجموعه‌ها را بازنشانی کنند" });
      }

      const { id } = req.params;
      
      // Check if the sub-user belongs to this level 1 user
      const existingSubUser = await storage.getUser(id);
      if (!existingSubUser || existingSubUser.parentUserId !== req.user.id) {
        return res.status(404).json({ message: "زیرمجموعه یافت نشد یا متعلق به شما نیست" });
      }

      // Generate 7-digit random password (numbers only)
      const generateRandomPassword = () => {
        let password = '';
        for (let i = 0; i < 7; i++) {
          password += Math.floor(Math.random() * 10).toString();
        }
        return password;
      };

      const newPassword = generateRandomPassword();
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update user password
      const updatedUser = await storage.updateUserPassword(id, hashedPassword);
      if (!updatedUser) {
        return res.status(500).json({ message: "خطا در بازنشانی رمز عبور" });
      }

      // Send password via WhatsApp if user has phone number
      let sentViaWhatsApp = false;
      let whatsappMessage = "";
      
      try {
        const { whatsAppSender } = await import('./whatsapp-sender');
        if (existingSubUser.phone) {
          const message = `🔐 رمز عبور جدید شما:\n\n${newPassword}\n\nلطفاً این رمز عبور را در مکان امنی نگهداری کنید و پس از ورود اول آن را تغییر دهید.`;
          sentViaWhatsApp = await whatsAppSender.sendMessage(existingSubUser.phone, message, req.user.id);
          whatsappMessage = sentViaWhatsApp ? "رمز عبور از طریق واتس‌اپ ارسال شد" : "ارسال واتس‌اپ ناموفق بود";
        } else {
          whatsappMessage = "شماره تلفن کاربر موجود نیست";
        }
      } catch (whatsappError) {
        console.warn("خطا در ارسال رمز عبور از طریق واتس‌اپ:", whatsappError);
        whatsappMessage = "خطا در ارسال واتس‌اپ";
      }

      res.json({ 
        userId: id,
        username: existingSubUser.username,
        newPassword: newPassword,
        message: sentViaWhatsApp ? "رمز عبور جدید تولید و از طریق واتس‌اپ ارسال شد" : `رمز عبور جدید تولید شد - ${whatsappMessage}`,
        sentViaWhatsApp,
        whatsappStatus: whatsappMessage
      });
    } catch (error) {
      console.error("خطا در بازنشانی رمز عبور:", error);
      res.status(500).json({ message: "خطا در بازنشانی رمز عبور" });
    }
  });

  // Profile routes
  app.get("/api/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      res.json({ ...user!, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت پروفایل" });
    }
  });

  app.put("/api/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { firstName, lastName, phone } = req.body;
      
      // Only admins can update their phone number
      const updateData: any = { firstName, lastName };
      if (req.user!.role === "admin" && phone) {
        updateData.phone = phone;
      }
      
      const user = await storage.updateUser(req.user!.id, updateData);
      
      res.json({ ...user!, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "خطا در بروزرسانی پروفایل" });
    }
  });

  app.post("/api/profile/picture", authenticateToken, upload.single("profilePicture"), async (req: AuthRequest, res) => {
    try {
      if (!(req as any).file) {
        return res.status(400).json({ message: "فایل تصویر مورد نیاز است" });
      }

      const profilePicture = `/uploads/${(req as any).file.filename}`;
      const user = await storage.updateUser(req.user!.id, { profilePicture });
      
      res.json({ ...user!, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "خطا در آپلود تصویر پروفایل" });
    }
  });

  // Ticket routes
  app.get("/api/tickets", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let tickets;
      // مدیر و کاربر سطح ۱ هر دو تیکت‌های کل سیستم را ببینند
      if (req.user!.role === "admin" || req.user!.role === "user_level_1") {
        tickets = await storage.getAllTickets();
      } else {
        tickets = await storage.getTicketsByUser(req.user!.id);
      }
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت تیکت ها" });
    }
  });

  app.post("/api/tickets", authenticateToken, upload.array("attachments", 5), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertTicketSchema.parse({
        ...req.body,
        userId: req.user!.id,
        attachments: (req as any).files ? ((req as any).files as any[]).map((file: any) => `/uploads/${file.filename}`) : [],
      });
      
      const ticket = await storage.createTicket(validatedData);
      
      // ارسال اعلان به مدیر برای تیکت جدید
      try {
        const whatsappSettings = await storage.getWhatsappSettings();
        if (whatsappSettings?.notifications?.includes('new_ticket') && whatsappSettings.isEnabled && whatsappSettings.token) {
          const adminUser = await storage.getUserByUsername("ehsan");
          if (adminUser && adminUser.phone) {
            const ticketUser = await storage.getUser(req.user!.id);
            const message = `🎫 تیکت جدید ثبت شد\n\nکاربر: ${ticketUser?.firstName} ${ticketUser?.lastName}\nموضوع: ${ticket.subject}\nاولویت: ${ticket.priority === 'high' ? 'بالا' : ticket.priority === 'medium' ? 'متوسط' : 'پایین'}`;
            await whatsAppSender.sendMessage(adminUser.phone, message, adminUser.id);
          }
        }
      } catch (notificationError) {
        console.error("خطا در ارسال اعلان تیکت جدید:", notificationError);
      }
      
      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ایجاد تیکت" });
    }
  });

  app.put("/api/tickets/:id/reply", authenticateToken, requireAdminOrLevel1, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body using Zod schema
      const validatedData = ticketReplySchema.parse({
        message: req.body.adminReply || req.body.message
      });
      const { message } = validatedData;
      
      // Get current ticket
      const ticket = await storage.getTicket(id);
      if (!ticket) {
        return res.status(404).json({ message: "تیکت یافت نشد" });
      }
      
      // Parse existing conversation thread
      const existingThread = parseConversationThread(ticket.adminReply);
      
      // Add new admin message to conversation thread
      const updatedThread = addMessageToThread(existingThread, message, true, 'پشتیبانی');
      
      // Serialize conversation thread back to JSON
      const serializedThread = serializeConversationThread(updatedThread);
      
      // Update ticket with new conversation thread
      const updatedTicket = await storage.updateTicket(id, {
        adminReply: serializedThread,
        adminReplyAt: new Date(),
        status: "read",
        lastResponseAt: new Date(),
      });
      
      if (!updatedTicket) {
        return res.status(404).json({ message: "تیکت یافت نشد" });
      }

      res.json(updatedTicket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در پاسخ به تیکت" });
    }
  });

  app.delete("/api/tickets/:id", authenticateToken, requireAdminOrLevel1, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTicket(id);
      
      if (!success) {
        return res.status(404).json({ message: "تیکت یافت نشد" });
      }

      res.json({ message: "تیکت با موفقیت حذف شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در حذف تیکت" });
    }
  });

  // User-specific tickets with details
  app.get("/api/my-tickets", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const tickets = await storage.getTicketsByUser(req.user!.id);
      
      // For each ticket, parse the conversation thread
      const ticketsWithResponses = tickets.map(ticket => ({
        ...ticket,
        responses: parseConversationThread(ticket.adminReply)
      }));
      
      res.json(ticketsWithResponses);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت تیکت‌ها" });
    }
  });

  // User reply to ticket (POST version for users)
  app.post("/api/tickets/:id/reply", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body using Zod schema
      const validatedData = ticketReplySchema.parse(req.body);
      const { message } = validatedData;
      
      // Check if ticket belongs to user or user is admin
      const ticket = await storage.getTicket(id);
      if (!ticket) {
        return res.status(404).json({ message: "تیکت یافت نشد" });
      }
      
      if (req.user!.role !== "admin" && ticket.userId !== req.user!.id) {
        return res.status(403).json({ message: "دسترسی به این تیکت ندارید" });
      }
      
      // Parse existing conversation thread
      const existingThread = parseConversationThread(ticket.adminReply);
      
      // Determine user name and admin status
      const isAdmin = req.user!.role === "admin";
      const userName = isAdmin ? 'پشتیبانی' : `${req.user!.firstName} ${req.user!.lastName}`;
      
      // Add new message to conversation thread
      const updatedThread = addMessageToThread(existingThread, message, isAdmin, userName);
      
      // Serialize conversation thread back to JSON
      const serializedThread = serializeConversationThread(updatedThread);
      
      // Update ticket with new conversation thread
      const updatedTicket = await storage.updateTicket(id, {
        adminReply: serializedThread,
        adminReplyAt: new Date(),
        status: "read",
        lastResponseAt: new Date(),
      });
      
      res.json(updatedTicket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ارسال پاسخ" });
    }
  });

  // Subscription routes (Admin only)
  app.get("/api/subscriptions", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const subscriptions = await storage.getAllSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت اشتراک ها" });
    }
  });

  app.post("/api/subscriptions", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSubscriptionSchema.parse(req.body);
      
      // Note: insertSubscriptionSchema already omits isDefault, so this check is not needed
      // but we keep it for safety
      
      // Force isDefault to false for all user-created subscriptions
      const safeData = { ...validatedData, isDefault: false };
      
      const subscription = await storage.createSubscription(safeData);
      res.json(subscription);
    } catch (error) {
      console.error("خطا در ایجاد اشتراک:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ایجاد اشتراک" });
    }
  });

  app.put("/api/subscriptions/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Get current subscription to check if it's the default free subscription
      const currentSubscription = await storage.getSubscription(id);
      if (!currentSubscription) {
        return res.status(404).json({ message: "اشتراک یافت نشد" });
      }
      
      // Prevent ANY modifications to default subscription (complete immutability)
      if (currentSubscription.isDefault) {
        return res.status(400).json({ 
          message: "امکان تغییر اشتراک پیش فرض رایگان وجود ندارد" 
        });
      } else {
        // Prevent setting isDefault=true on non-default subscriptions
        if (updates.isDefault === true) {
          return res.status(400).json({ 
            message: "تنها یک اشتراک پیش فرض می تواند وجود داشته باشد" 
          });
        }
      }
      
      const subscription = await storage.updateSubscription(id, updates);
      if (!subscription) {
        return res.status(404).json({ message: "اشتراک یافت نشد" });
      }

      res.json(subscription);
    } catch (error) {
      console.error("خطا در بروزرسانی اشتراک:", error);
      res.status(500).json({ message: "خطا در بروزرسانی اشتراک" });
    }
  });

  app.delete("/api/subscriptions/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get subscription details first to check if it's the default free subscription
      const subscription = await storage.getSubscription(id);
      if (!subscription) {
        return res.status(404).json({ message: "اشتراک یافت نشد" });
      }
      
      // Prevent deletion of default subscription
      if (subscription.isDefault) {
        return res.status(400).json({ 
          message: "امکان حذف اشتراک پیش فرض رایگان وجود ندارد" 
        });
      }
      
      const success = await storage.deleteSubscription(id);
      
      if (!success) {
        return res.status(404).json({ message: "اشتراک یافت نشد" });
      }

      res.json({ message: "اشتراک با موفقیت حذف شد" });
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ message: "خطا در حذف اشتراک" });
    }
  });

  // AI Token routes
  app.get("/api/ai-token", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllAiTokenSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت توکن هوش مصنوعی" });
    }
  });

  app.get("/api/ai-token/:provider", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { provider } = req.params;
      const settings = await storage.getAiTokenSettings(provider);
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت توکن هوش مصنوعی" });
    }
  });

  app.post("/api/ai-token", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertAiTokenSettingsSchema.parse(req.body);
      const settings = await storage.updateAiTokenSettings(validatedData);
      
      // بازخوانی سرویس AI مناسب با توکن جدید
      const { aiService } = await import("./ai-service");
      await aiService.reinitialize();
      
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ذخیره توکن هوش مصنوعی" });
    }
  });

  // Blockchain Settings routes
  app.get("/api/blockchain-settings", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllBlockchainSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت تنظیمات بلاکچین" });
    }
  });

  app.get("/api/blockchain-settings/:provider", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { provider } = req.params;
      const settings = await storage.getBlockchainSettings(provider);
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت تنظیمات بلاکچین" });
    }
  });

  app.post("/api/blockchain-settings", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBlockchainSettingsSchema.parse(req.body);
      const settings = await storage.updateBlockchainSettings(validatedData);
      
      // بازخوانی سرویس کاردانو با توکن جدید
      if (validatedData.provider === 'cardano') {
        const { cardanoService } = await import("./cardano-service");
        await cardanoService.reloadApiKey();
      }
      
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ذخیره تنظیمات بلاکچین" });
    }
  });

  // Product routes
  app.get("/api/products", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const products = await storage.getAllProducts(req.user!.id, req.user!.role);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت محصولات" });
    }
  });

  // Shop products route for level 2 users to view parent products
  app.get("/api/products/shop", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "user_level_2") {
        return res.status(403).json({ message: "دسترسی محدود - این عملیات مخصوص کاربران سطح ۲ است" });
      }
      const products = await storage.getAllProducts(req.user!.id, req.user!.role);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت محصولات فروشگاه" });
    }
  });

  app.post("/api/products", authenticateToken, upload.single("productImage"), async (req: AuthRequest, res) => {
    try {
      let imageData = null;
      
      // اگر فایل آپلود شده باشد، مسیر آن را ذخیره می‌کنیم
      if ((req as any).file) {
        // مسیر فایل آپلود شده را ذخیره می‌کنیم
        imageData = `/uploads/${(req as any).file.filename}`;
      }
      
      // Validate categoryId if provided
      if (req.body.categoryId) {
        console.log(`🔍 DEBUG CREATE: Checking category ${req.body.categoryId} for user ${req.user!.id} with role ${req.user!.role}`);
        const category = await storage.getCategory(req.body.categoryId, req.user!.id, req.user!.role);
        console.log(`🔍 DEBUG CREATE: Found category:`, category);
        if (!category || !category.isActive) {
          console.log(`❌ DEBUG CREATE: Category validation failed - category: ${!!category}, isActive: ${category?.isActive}`);
          return res.status(400).json({ message: "دسته‌بندی انتخاب شده معتبر نیست" });
        }
        console.log(`✅ DEBUG CREATE: Category validation passed`);
      }

      const validatedData = insertProductSchema.parse({
        ...req.body,
        userId: req.user!.id,
        image: imageData,
        categoryId: req.body.categoryId || null,
        priceBeforeDiscount: req.body.priceBeforeDiscount,
        priceAfterDiscount: req.body.priceAfterDiscount || null,
        quantity: parseInt(req.body.quantity),
      });
      
      const product = await storage.createProduct(validatedData);
      res.json(product);
    } catch (error) {
      console.error("خطا در ایجاد محصول:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ایجاد محصول" });
    }
  });

  app.put("/api/products/:id", authenticateToken, upload.single("productImage"), async (req: AuthRequest, res) => {
    try {
      // user_level_2 cannot modify products, only view them
      if (req.user!.role === 'user_level_2') {
        return res.status(403).json({ message: "شما اجازه تغییر محصولات را ندارید" });
      }
      
      const { id } = req.params;
      let updates = { ...req.body };
      
      // Validate categoryId if provided
      if (req.body.categoryId) {
        const category = await storage.getCategory(req.body.categoryId, req.user!.id, req.user!.role);
        if (!category || !category.isActive) {
          return res.status(400).json({ message: "دسته‌بندی انتخاب شده معتبر نیست" });
        }
      }
      
      // اگر فایل جدید آپلود شده باشد، مسیر آن را ذخیره می‌کنیم
      if ((req as any).file) {
        // مسیر فایل آپلود شده را ذخیره می‌کنیم
        updates.image = `/uploads/${(req as any).file.filename}`;
      }
      
      const updatedProduct = await storage.updateProduct(id, updates, req.user!.id, req.user!.role);
      if (!updatedProduct) {
        return res.status(404).json({ message: "محصول یافت نشد" });
      }
      res.json(updatedProduct);
    } catch (error) {
      console.error("خطا در بروزرسانی محصول:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده‌های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در بروزرسانی محصول" });
    }
  });

  app.delete("/api/products/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // user_level_2 cannot modify products, only view them
      if (req.user!.role === 'user_level_2') {
        return res.status(403).json({ message: "شما اجازه حذف محصولات را ندارید" });
      }
      
      const { id } = req.params;
      
      const success = await storage.deleteProduct(id, req.user!.id, req.user!.role);
      if (!success) {
        return res.status(404).json({ message: "محصول یافت نشد" });
      }
      res.json({ message: "محصول با موفقیت حذف شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در حذف محصول" });
    }
  });

  // WhatsApp settings routes (Admin and Level 1 users)
  app.get("/api/whatsapp-settings", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      // For level 1 users, return their individual token if they have one
      if (user.role === 'user_level_1') {
        res.json({
          token: user.whatsappToken || '',
          isEnabled: !!user.whatsappToken,
          notifications: [],
          aiName: "من هوش مصنوعی هستم",
          isPersonal: true
        });
      } else {
        // For admin, return global settings
        const settings = await storage.getWhatsappSettings();
        res.json({
          ...settings,
          aiName: settings?.aiName || "من هوش مصنوعی هستم",
          isPersonal: false
        });
      }
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت تنظیمات واتس اپ" });
    }
  });

  app.put("/api/whatsapp-settings", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      // For level 1 users, update their personal token
      if (user.role === 'user_level_1') {
        const { token } = req.body;
        const updatedUser = await storage.updateUser(user.id, { 
          whatsappToken: token || null 
        });
        
        if (!updatedUser) {
          return res.status(404).json({ message: "کاربر یافت نشد" });
        }
        
        res.json({
          token: updatedUser.whatsappToken || '',
          isEnabled: !!updatedUser.whatsappToken,
          notifications: [],
          aiName: "من هوش مصنوعی هستم",
          isPersonal: true
        });
      } else {
        // For admin, update global settings
        const validatedData = insertWhatsappSettingsSchema.parse(req.body);
        const settings = await storage.updateWhatsappSettings(validatedData);
        res.json({
          ...settings,
          isPersonal: false
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در بروزرسانی تنظیمات واتس اپ" });
    }
  });

  // Message routes (Admin and Level 1 users)
  app.get("/api/messages/sent", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const messages = await storage.getSentMessagesByUser(req.user!.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت پیام‌های ارسالی" });
    }
  });

  app.get("/api/messages/received", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 7; // پیش‌فرض 7 پیام در هر صفحه
      
      const result = await storage.getReceivedMessagesByUserPaginated(req.user!.id, page, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت پیام‌های دریافتی" });
    }
  });

  app.post("/api/messages/sent", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertSentMessageSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      
      const message = await storage.createSentMessage(validatedData);
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ثبت پیام ارسالی" });
    }
  });

  app.post("/api/messages/received", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertReceivedMessageSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      
      const message = await storage.createReceivedMessage(validatedData);
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ثبت پیام دریافتی" });
    }
  });

  app.get("/api/messages/whatsapp-unread-count", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const result = await storage.getReceivedMessagesByUserPaginated(req.user!.id, 1, 10000);
      const unreadCount = result.messages.filter(msg => msg.status === "خوانده نشده").length;
      res.json({ unreadCount });
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت تعداد پیام‌های خوانده نشده" });
    }
  });

  app.put("/api/messages/received/:id/read", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const message = await storage.updateReceivedMessageStatus(id, "خوانده شده");
      
      if (!message) {
        return res.status(404).json({ message: "پیام یافت نشد" });
      }

      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "خطا در بروزرسانی وضعیت پیام" });
    }
  });

  // User Subscription routes
  // Get user's current subscription
  app.get("/api/user-subscriptions/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userSubscription = await storage.getUserSubscription(req.user!.id);
      res.json(userSubscription);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت اشتراک کاربر" });
    }
  });

  // Get all user subscriptions (Admin only)
  app.get("/api/user-subscriptions", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const userSubscriptions = await storage.getAllUserSubscriptions();
      res.json(userSubscriptions);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت اشتراک‌های کاربران" });
    }
  });

  // Create user subscription
  app.post("/api/user-subscriptions", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertUserSubscriptionSchema.parse(req.body);
      const userSubscription = await storage.createUserSubscription(validatedData);
      res.json(userSubscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ایجاد اشتراک کاربر" });
    }
  });

  // Update user subscription
  app.put("/api/user-subscriptions/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const userSubscription = await storage.updateUserSubscription(id, updates);
      if (!userSubscription) {
        return res.status(404).json({ message: "اشتراک کاربر یافت نشد" });
      }

      res.json(userSubscription);
    } catch (error) {
      res.status(500).json({ message: "خطا در بروزرسانی اشتراک کاربر" });
    }
  });

  // Update remaining days (for daily reduction)
  app.put("/api/user-subscriptions/:id/remaining-days", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { remainingDays } = req.body;
      
      if (typeof remainingDays !== 'number') {
        return res.status(400).json({ message: "تعداد روزهای باقیمانده باید عدد باشد" });
      }
      
      const userSubscription = await storage.updateRemainingDays(id, remainingDays);
      if (!userSubscription) {
        return res.status(404).json({ message: "اشتراک کاربر یافت نشد" });
      }

      res.json(userSubscription);
    } catch (error) {
      res.status(500).json({ message: "خطا در بروزرسانی روزهای باقیمانده" });
    }
  });

  // Daily subscription reduction endpoint (for cron job)
  app.post("/api/user-subscriptions/daily-reduction", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const activeSubscriptions = await storage.getActiveUserSubscriptions();
      const updatedSubscriptions = [];
      
      for (const subscription of activeSubscriptions) {
        if (subscription.remainingDays > 0) {
          const newRemainingDays = subscription.remainingDays - 1;
          const updated = await storage.updateRemainingDays(subscription.id, newRemainingDays);
          if (updated) {
            updatedSubscriptions.push(updated);
          }
        }
      }
      
      res.json({
        message: `${updatedSubscriptions.length} اشتراک بروزرسانی شد`,
        updatedSubscriptions
      });
    } catch (error) {
      console.error("خطا در کاهش روزانه اشتراک‌ها:", error);
      res.status(500).json({ message: "خطا در کاهش روزانه اشتراک‌ها" });
    }
  });

  // Get active subscriptions
  app.get("/api/user-subscriptions/active", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const activeSubscriptions = await storage.getActiveUserSubscriptions();
      res.json(activeSubscriptions);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت اشتراک‌های فعال" });
    }
  });

  // Get expired subscriptions  
  app.get("/api/user-subscriptions/expired", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const expiredSubscriptions = await storage.getExpiredUserSubscriptions();
      res.json(expiredSubscriptions);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت اشتراک‌های منقضی" });
    }
  });

  // Subscribe to plan endpoint (for users)
  app.post("/api/user-subscriptions/subscribe", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ message: "شناسه اشتراک مورد نیاز است" });
      }
      
      // Check if subscription exists
      const subscription = await storage.getSubscription(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ message: "اشتراک یافت نشد" });
      }
      
      if (!subscription.isActive) {
        return res.status(400).json({ message: "این اشتراک فعال نیست" });
      }
      
      // Check if user already has an active subscription
      const existingSubscription = await storage.getUserSubscription(req.user!.id);
      if (existingSubscription && existingSubscription.remainingDays > 0) {
        return res.status(400).json({ message: "شما اشتراک فعال دارید" });
      }
      
      // Calculate duration in days
      const durationInDays = subscription.duration === 'monthly' ? 30 : 365;
      
      // Create new user subscription
      const userSubscription = await storage.createUserSubscription({
        userId: req.user!.id,
        subscriptionId: subscriptionId,
        remainingDays: durationInDays,
        startDate: new Date(),
        endDate: new Date(Date.now() + durationInDays * 24 * 60 * 60 * 1000),
        status: "active",
      });
      
      res.json(userSubscription);
    } catch (error) {
      console.error("خطا در ثبت اشتراک:", error);
      res.status(500).json({ message: "خطا در ثبت اشتراک" });
    }
  });

  // Categories API
  // Get all categories
  app.get("/api/categories", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const categories = await storage.getAllCategories(req.user!.id, req.user!.role);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت دسته‌بندی‌ها" });
    }
  });

  // Get category tree
  app.get("/api/categories/tree", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tree = await storage.getCategoryTree(req.user!.id, req.user!.role);
      res.json(tree);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت ساختار درختی دسته‌بندی‌ها" });
    }
  });

  // Get categories by parent
  app.get("/api/categories/by-parent/:parentId?", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const parentId = req.params.parentId === 'null' ? null : req.params.parentId;
      const categories = await storage.getCategoriesByParent(parentId, req.user!.id, req.user!.role);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت زیر دسته‌بندی‌ها" });
    }
  });

  // Create category
  app.post("/api/categories", authenticateToken, requireAdminOrUserLevel1, async (req: AuthRequest, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData, req.user!.id);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده‌های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ایجاد دسته‌بندی" });
    }
  });

  // Get single category (UUID constrained)
  app.get("/api/categories/:id([0-9a-fA-F-]{36})", authenticateToken, requireAdminOrUserLevel1, async (req: AuthRequest, res) => {
    try {
      const category = await storage.getCategory(req.params.id, req.user!.id, req.user!.role);
      if (!category) {
        return res.status(404).json({ message: "دسته‌بندی یافت نشد" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت دسته‌بندی" });
    }
  });

  // Update category (UUID constrained)
  app.put("/api/categories/:id([0-9a-fA-F-]{36})", authenticateToken, requireAdminOrUserLevel1, async (req: AuthRequest, res) => {
    try {
      const updates = req.body;
      // Server-side control: prevent modification of createdBy
      delete updates.createdBy;
      const category = await storage.updateCategory(req.params.id, updates, req.user!.id, req.user!.role);
      if (!category) {
        return res.status(404).json({ message: "دسته‌بندی یافت نشد" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "خطا در بروزرسانی دسته‌بندی" });
    }
  });

  // Reorder categories (must be before :id routes)
  app.put("/api/categories/reorder", authenticateToken, requireAdminOrUserLevel1, async (req, res) => {
    try {
      const updates = z.array(updateCategoryOrderSchema).parse(req.body);
      
      // Map client format to storage format
      const mappedUpdates = updates.map(update => ({
        id: update.categoryId,
        order: update.newOrder,
        parentId: update.newParentId || null
      }));
      
      const success = await storage.reorderCategories(mappedUpdates);
      if (!success) {
        return res.status(400).json({ message: "خطا در تغییر ترتیب دسته‌بندی‌ها" });
      }
      
      res.json({ message: "ترتیب دسته‌بندی‌ها با موفقیت بروزرسانی شد" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده‌های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در تغییر ترتیب دسته‌بندی‌ها" });
    }
  });

  // Delete category (UUID constrained)
  app.delete("/api/categories/:id([0-9a-fA-F-]{36})", authenticateToken, requireAdminOrUserLevel1, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteCategory(req.params.id, req.user!.id, req.user!.role);
      if (!success) {
        return res.status(404).json({ message: "دسته‌بندی یافت نشد" });
      }
      res.json({ message: "دسته‌بندی با موفقیت حذف شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در حذف دسته‌بندی" });
    }
  });

  // Welcome message routes
  app.get("/api/welcome-message", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      // پیام پیش‌فرض اگر کاربر پیام سفارشی نداشته باشد
      const defaultMessage = `سلام {firstName}! 🌟

به سیستم ما خوش آمدید. شما با موفقیت ثبت نام شدید.

🎁 اشتراک رایگان 7 روزه به حساب شما اضافه شد.

برای کمک و راهنمایی، می‌توانید هر زمان پیام بدهید.`;

      res.json({ message: user.welcomeMessage || defaultMessage });
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت پیام خوش آمدگویی" });
    }
  });

  app.post("/api/welcome-message", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { message } = req.body;
      
      if (typeof message !== "string") {
        return res.status(400).json({ message: "پیام باید متنی باشد" });
      }

      const user = req.user!;
      await storage.updateUser(user.id, { welcomeMessage: message });
      
      res.json({ message: "پیام خوش آمدگویی با موفقیت ذخیره شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در ذخیره پیام خوش آمدگویی" });
    }
  });

  // Cart routes - Only for user_level_2
  const requireLevel2 = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== "user_level_2") {
      return res.status(403).json({ message: "دسترسی محدود - این عملیات مخصوص کاربران سطح ۲ است" });
    }
    next();
  };

  // Cart validation schemas
  const addToCartSchema = z.object({
    productId: z.string().uuid("شناسه محصول باید UUID معتبر باشد"),
    quantity: z.number().int().min(1, "تعداد باید حداقل ۱ باشد"),
  });

  const updateQuantitySchema = z.object({
    quantity: z.number().int().min(1, "تعداد باید حداقل ۱ باشد"),
  });

  // Get cart items for user
  app.get("/api/cart", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const cartItems = await storage.getCartItemsWithProducts(req.user!.id);
      res.json(cartItems);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت سبد خرید" });
    }
  });

  // Add item to cart
  app.post("/api/cart/add", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const validatedData = addToCartSchema.parse(req.body);
      const { productId, quantity } = validatedData;

      const cartItem = await storage.addToCart(req.user!.id, productId, quantity);
      res.json(cartItem);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "داده‌های ورودی نامعتبر" });
      }
      res.status(500).json({ message: error.message || "خطا در اضافه کردن به سبد خرید" });
    }
  });

  // Update cart item quantity
  app.patch("/api/cart/items/:itemId", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const validatedData = updateQuantitySchema.parse(req.body);
      const { quantity } = validatedData;

      const updatedItem = await storage.updateCartItemQuantity(req.params.itemId, quantity, req.user!.id);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "آیتم سبد خرید یافت نشد" });
      }

      res.json(updatedItem);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "داده‌های ورودی نامعتبر" });
      }
      res.status(500).json({ message: "خطا در بروزرسانی تعداد" });
    }
  });

  // Remove item from cart
  app.delete("/api/cart/items/:itemId", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const success = await storage.removeFromCart(req.params.itemId, req.user!.id);
      
      if (!success) {
        return res.status(404).json({ message: "آیتم سبد خرید یافت نشد" });
      }

      res.json({ message: "آیتم با موفقیت از سبد حذف شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در حذف آیتم از سبد" });
    }
  });

  // Clear entire cart
  app.delete("/api/cart/clear", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const success = await storage.clearCart(req.user!.id);
      
      if (!success) {
        return res.status(404).json({ message: "سبد خرید یافت نشد" });
      }

      res.json({ message: "سبد خرید با موفقیت پاک شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در پاک کردن سبد خرید" });
    }
  });

  // =================
  // ADDRESS ROUTES
  // =================
  
  // Get user addresses
  app.get("/api/addresses", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const addresses = await storage.getAddressesByUser(req.user!.id);
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت آدرس‌ها" });
    }
  });

  // Create new address
  app.post("/api/addresses", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertAddressSchema.parse({
        ...req.body,
        userId: req.user!.id
      });

      const address = await storage.createAddress(validatedData);
      res.status(201).json(address);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "داده‌های ورودی نامعتبر" });
      }
      res.status(500).json({ message: "خطا در ایجاد آدرس" });
    }
  });

  // Update address
  app.put("/api/addresses/:id", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const validatedData = updateAddressSchema.parse(req.body);
      const updatedAddress = await storage.updateAddress(req.params.id, validatedData, req.user!.id);
      
      if (!updatedAddress) {
        return res.status(404).json({ message: "آدرس یافت نشد" });
      }

      res.json(updatedAddress);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "داده‌های ورودی نامعتبر" });
      }
      res.status(500).json({ message: "خطا در بروزرسانی آدرس" });
    }
  });

  // Delete address
  app.delete("/api/addresses/:id", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteAddress(req.params.id, req.user!.id);
      
      if (!success) {
        return res.status(404).json({ message: "آدرس یافت نشد" });
      }

      res.json({ message: "آدرس با موفقیت حذف شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در حذف آدرس" });
    }
  });

  // Set default address
  app.put("/api/addresses/:id/default", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const success = await storage.setDefaultAddress(req.params.id, req.user!.id);
      
      if (!success) {
        return res.status(404).json({ message: "آدرس یافت نشد" });
      }

      res.json({ message: "آدرس پیش‌فرض تنظیم شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در تنظیم آدرس پیش‌فرض" });
    }
  });

  // =================
  // ORDER ROUTES
  // =================
  
  // Get user orders (for level 2 users - their own orders)
  app.get("/api/orders", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const orders = await storage.getOrdersByUser(req.user!.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت سفارشات" });
    }
  });

  // Get seller info by order ID (for level 2 users to see payment details)
  app.get("/api/orders/:orderId/seller-info", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      
      if (!order) {
        return res.status(404).json({ message: "سفارش یافت نشد" });
      }

      // Verify that the order belongs to the current user
      if (order.userId !== req.user!.id) {
        return res.status(403).json({ message: "شما مجاز به دسترسی به این سفارش نیستید" });
      }

      // Get seller information
      const seller = await storage.getUser(order.sellerId);
      
      if (!seller) {
        return res.status(404).json({ message: "فروشنده یافت نشد" });
      }

      // Return only necessary seller information for payment
      res.json({
        sellerId: seller.id,
        sellerName: `${seller.firstName} ${seller.lastName}`,
        bankCardNumber: seller.bankCardNumber,
        bankCardHolderName: seller.bankCardHolderName,
        tronWalletAddress: seller.tronWalletAddress,
        usdtTrc20WalletAddress: seller.usdtTrc20WalletAddress,
        rippleWalletAddress: seller.rippleWalletAddress,
        cardanoWalletAddress: seller.cardanoWalletAddress
      });
    } catch (error) {
      console.error("Get seller info error:", error);
      res.status(500).json({ message: "خطا در دریافت اطلاعات فروشنده" });
    }
  });

  // Start payment timer for an order
  app.post("/api/orders/:orderId/start-payment-timer", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const { cryptoType } = req.body; // دریافت نوع ارز دیجیتال از body
      const order = await storage.getOrder(req.params.orderId);
      
      if (!order) {
        return res.status(404).json({ message: "سفارش یافت نشد" });
      }

      // Verify that the order belongs to the current user
      if (order.userId !== req.user!.id) {
        return res.status(403).json({ message: "شما مجاز به دسترسی به این سفارش نیستید" });
      }

      // چک کردن اینکه آیا timer قبلاً شروع شده و هنوز معتبر است
      if (order.paymentStartedAt) {
        const startTime = new Date(order.paymentStartedAt).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
        const totalSeconds = 10 * 60; // 10 minutes
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        
        // اگر timer هنوز معتبر است (expire نشده)، دوباره set نکن
        if (remainingSeconds > 0) {
          console.log(`⏱️ Timer قبلاً موجود است برای سفارش ${req.params.orderId} - باقیمانده: ${remainingSeconds}s`);
          return res.json({
            success: true,
            paymentStartedAt: order.paymentStartedAt,
            cryptoType: (order as any).selectedCryptoType,
            alreadyStarted: true,
            remainingSeconds
          });
        }
        
        console.log(`⌛ Timer قبلی expire شده برای سفارش ${req.params.orderId} - ایجاد timer جدید`);
      }

      // Set payment started time and crypto type - فقط اگر timer نیست یا expire شده
      const now = new Date();
      await db.update(orders).set({
        paymentStartedAt: now,
        selectedCryptoType: cryptoType || null
      }).where(eq(orders.id, req.params.orderId));

      console.log(`✅ Timer جدید شروع شد برای سفارش ${req.params.orderId} با ارز ${cryptoType || 'نامشخص'}`);
      
      res.json({
        success: true,
        paymentStartedAt: now.toISOString(),
        cryptoType: cryptoType || null,
        alreadyStarted: false
      });
    } catch (error) {
      console.error("Start payment timer error:", error);
      res.status(500).json({ message: "خطا در شروع تایمر پرداخت" });
    }
  });

  // Get payment timer status for an order
  app.get("/api/orders/:orderId/payment-timer", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      // بدون cache برای تایمر - هر بار جواب جدید
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const order = await storage.getOrder(req.params.orderId);
      
      if (!order) {
        return res.status(404).json({ message: "سفارش یافت نشد" });
      }

      // Verify that the order belongs to the current user
      if (order.userId !== req.user!.id) {
        return res.status(403).json({ message: "شما مجاز به دسترسی به این سفارش نیستید" });
      }

      if (!order.paymentStartedAt) {
        return res.json({
          hasTimer: false,
          remainingSeconds: 0,
          cryptoType: null
        });
      }

      const startTime = new Date(order.paymentStartedAt).getTime();
      const currentTime = new Date().getTime();
      const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
      const totalSeconds = 10 * 60; // 10 minutes
      const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

      res.json({
        hasTimer: true,
        paymentStartedAt: order.paymentStartedAt,
        cryptoType: (order as any).selectedCryptoType || null,
        remainingSeconds,
        isExpired: remainingSeconds === 0
      });
    } catch (error) {
      console.error("Get payment timer error:", error);
      res.status(500).json({ message: "خطا در دریافت وضعیت تایمر پرداخت" });
    }
  });

  // Get orders for seller (for level 1 users - orders from their customers)
  app.get("/api/orders/seller", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const orders = await storage.getOrdersBySeller(req.user!.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت سفارشات" });
    }
  });

  // Get new orders count for notifications (for level 1 users only)
  app.get("/api/notifications/orders", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const count = await storage.getNewOrdersCount(req.user!.id);
      res.json({ newOrdersCount: count });
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت اطلاعات اعلان‌ها" });
    }
  });

  // Get unshipped orders count for dashboard
  app.get("/api/dashboard/unshipped-orders", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const unshippedOrdersCount = await storage.getUnshippedOrdersCount(req.user!.id);
      res.json({ unshippedOrdersCount });
    } catch (error: any) {
      console.error("Get unshipped orders count error:", error);
      res.status(500).json({ message: "خطا در دریافت آمار پیشخوان" });
    }
  });

  // Get paid orders count for level 1 users (orders with status other than awaiting_payment)
  app.get("/api/orders/paid-orders-count", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const paidOrdersCount = await storage.getPaidOrdersCount(req.user!.id);
      res.json({ paidOrdersCount });
    } catch (error: any) {
      console.error("Get paid orders count error:", error);
      res.status(500).json({ message: "خطا در دریافت تعداد سفارشات پرداخت شده" });
    }
  });

  // Get pending orders count for level 1 users (orders with status 'pending')
  app.get("/api/orders/pending-orders-count", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const pendingOrdersCount = await storage.getPendingOrdersCount(req.user!.id);
      res.json({ pendingOrdersCount });
    } catch (error: any) {
      console.error("Get pending orders count error:", error);
      res.status(500).json({ message: "خطا در دریافت تعداد سفارشات در حال تایید" });
    }
  });

  // Get pending transactions count for level 1 users
  app.get("/api/transactions/pending-count", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const pendingTransactionsCount = await storage.getPendingTransactionsCount(req.user!.id);
      res.json({ pendingTransactionsCount });
    } catch (error: any) {
      console.error("Get pending transactions count error:", error);
      res.status(500).json({ message: "خطا در دریافت تعداد تراکنش‌های در انتظار بررسی" });
    }
  });

  // Get pending payment orders count for level 2 users
  app.get("/api/user/orders/pending-payment-count", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const pendingPaymentOrdersCount = await storage.getPendingPaymentOrdersCount(req.user!.id);
      res.json({ pendingPaymentOrdersCount });
    } catch (error: any) {
      console.error("Get pending payment orders count error:", error);
      res.status(500).json({ message: "خطا در دریافت تعداد سفارشات در انتظار پرداخت" });
    }
  });

  // Pay from balance and create order
  app.post("/api/orders/pay-from-balance", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const cartItems = await storage.getCartItemsWithProducts(req.user!.id);
      
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "سبد خرید خالی است" });
      }

      // محاسبه مبلغ کل سبد خرید
      let totalCartAmount = 0;
      const ordersBySeller = new Map();
      
      for (const item of cartItems) {
        const product = await storage.getProduct(item.productId, req.user!.id, req.user!.role);
        if (!product) continue;
        
        const sellerId = product.userId;
        if (!ordersBySeller.has(sellerId)) {
          ordersBySeller.set(sellerId, {
            items: [],
            totalAmount: 0
          });
        }
        
        const sellerOrder = ordersBySeller.get(sellerId);
        sellerOrder.items.push(item);
        sellerOrder.totalAmount += parseFloat(item.totalPrice);
      }

      // محاسبه مبلغ کل با VAT
      for (const [sellerId, orderData] of Array.from(ordersBySeller.entries())) {
        const vatSettings = await storage.getVatSettings(sellerId);
        const vatPercentage = vatSettings?.isEnabled ? parseFloat(vatSettings.vatPercentage) : 0;
        const subtotal = orderData.totalAmount;
        const vatAmount = Math.round(subtotal * (vatPercentage / 100));
        totalCartAmount += subtotal + vatAmount;
      }

      // بررسی موجودی کاربر
      const userBalance = await storage.getUserBalance(req.user!.id);
      
      if (userBalance < totalCartAmount) {
        return res.status(400).json({ 
          message: "موجودی حساب شما کافی نیست",
          required: totalCartAmount,
          available: userBalance
        });
      }

      const createdOrders = [];
      
      // ایجاد سفارش برای هر فروشنده با وضعیت pending
      for (const [sellerId, orderData] of Array.from(ordersBySeller.entries())) {
        const vatSettings = await storage.getVatSettings(sellerId);
        const vatPercentage = vatSettings?.isEnabled ? parseFloat(vatSettings.vatPercentage) : 0;
        
        const subtotal = orderData.totalAmount;
        const vatAmount = Math.round(subtotal * (vatPercentage / 100));
        const totalWithVat = subtotal + vatAmount;
        
        const order = await storage.createOrder({
          userId: req.user!.id,
          sellerId,
          totalAmount: totalWithVat.toString(),
          status: 'pending', // در انتظار تایید
          addressId: req.body.addressId || null,
          shippingMethod: req.body.shippingMethod || null,
          notes: req.body.notes || null
        });

        // ایجاد آیتم‌های سفارش
        for (const item of orderData.items) {
          await storage.createOrderItem({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          });
        }

        // ثبت تراکنش کسر موجودی
        const { nanoid } = await import('nanoid');
        await storage.createTransaction({
          userId: req.user!.id,
          orderId: order.id,
          type: 'order_payment',
          amount: `-${totalWithVat}`,
          status: 'completed',
          transactionDate: new Date().toLocaleDateString('fa-IR'),
          transactionTime: new Date().toLocaleTimeString('fa-IR'),
          accountSource: 'موجودی کل',
          referenceId: `OP-${nanoid(10)}`,
        });

        createdOrders.push(order);
      }

      // پاک کردن سبد خرید
      await storage.clearCart(req.user!.id);

      // تولید و ارسال فاکتور برای همه سفارشات
      if (createdOrders.length > 0) {
        const user = await storage.getUser(req.user!.id);
        
        for (const order of createdOrders) {
          try {
            console.log(`🖼️ در حال تولید فاکتور برای سفارش ${order.id}...`);
            const invoiceUrl = await generateAndSaveInvoice(order.id);
            console.log(`✅ فاکتور ذخیره شد: ${invoiceUrl}`);
            
            if (user && user.whatsappNumber) {
              const success = await whatsAppSender.sendImage(
                user.whatsappNumber,
                `📄 فاکتور سفارش شما - پرداخت شده از اعتبار`,
                invoiceUrl,
                order.sellerId
              );
              
              if (success) {
                console.log(`✅ فاکتور با موفقیت به ${user.whatsappNumber} ارسال شد`);
              } else {
                console.log(`⚠️ ارسال فاکتور به ${user.whatsappNumber} ناموفق بود`);
              }
            }
          } catch (error) {
            console.error(`❌ خطا در تولید یا ارسال فاکتور برای سفارش ${order.id}:`, error);
          }
        }
      }

      res.status(201).json({ 
        message: "سفارش با موفقیت از اعتبار پرداخت شد",
        orders: createdOrders 
      });
    } catch (error: any) {
      console.error("Pay from balance error:", error);
      res.status(500).json({ message: "خطا در پرداخت از اعتبار" });
    }
  });

  // Create new order from cart
  app.post("/api/orders", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const cartItems = await storage.getCartItemsWithProducts(req.user!.id);
      
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "سبد خرید خالی است" });
      }

      // Group cart items by seller
      const ordersBySeller = new Map();
      for (const item of cartItems) {
        const product = await storage.getProduct(item.productId, req.user!.id, req.user!.role);
        if (!product) continue;
        
        const sellerId = product.userId;
        if (!ordersBySeller.has(sellerId)) {
          ordersBySeller.set(sellerId, {
            items: [],
            totalAmount: 0
          });
        }
        
        const sellerOrder = ordersBySeller.get(sellerId);
        sellerOrder.items.push(item);
        sellerOrder.totalAmount += parseFloat(item.totalPrice);
      }

      const createdOrders = [];
      
      // Create separate order for each seller
      for (const [sellerId, orderData] of Array.from(ordersBySeller.entries())) {
        // دریافت تنظیمات VAT فروشنده
        const vatSettings = await storage.getVatSettings(sellerId);
        const vatPercentage = vatSettings?.isEnabled ? parseFloat(vatSettings.vatPercentage) : 0;
        
        // محاسبه VAT و مبلغ نهایی
        const subtotal = orderData.totalAmount;
        const vatAmount = Math.round(subtotal * (vatPercentage / 100));
        const totalWithVat = subtotal + vatAmount;
        
        const order = await storage.createOrder({
          userId: req.user!.id,
          sellerId,
          totalAmount: totalWithVat.toString(),
          addressId: req.body.addressId || null,
          shippingMethod: req.body.shippingMethod || null,
          notes: req.body.notes || null
        });

        // Create order items
        for (const item of orderData.items) {
          await storage.createOrderItem({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          });
        }

        createdOrders.push(order);
      }

      // Clear the cart after successful order creation
      await storage.clearCart(req.user!.id);

      // تولید و ارسال فاکتور برای همه سفارشات
      if (createdOrders.length > 0) {
        const user = await storage.getUser(req.user!.id);
        
        for (const order of createdOrders) {
          try {
            console.log(`🖼️ در حال تولید فاکتور برای سفارش ${order.id}...`);
            const invoiceUrl = await generateAndSaveInvoice(order.id);
            console.log(`✅ فاکتور ذخیره شد: ${invoiceUrl}`);
            
            // ارسال فاکتور از طریق واتساپ اگر شماره واتساپ کاربر موجود باشد
            if (user && user.whatsappNumber) {
              const success = await whatsAppSender.sendImage(
                user.whatsappNumber,
                `📄 فاکتور سفارش شما`,
                invoiceUrl,
                order.sellerId
              );
              
              if (success) {
                console.log(`✅ فاکتور با موفقیت به ${user.whatsappNumber} ارسال شد`);
              } else {
                console.log(`⚠️ ارسال فاکتور به ${user.whatsappNumber} ناموفق بود`);
              }
            }
          } catch (error) {
            console.error(`❌ خطا در تولید یا ارسال فاکتور برای سفارش ${order.id}:`, error);
            // خطای فاکتور نباید مانع ثبت سفارش شود
          }
        }
      }

      res.status(201).json({ 
        message: "سفارش با موفقیت ثبت شد",
        orders: createdOrders 
      });
    } catch (error: any) {
      console.error("Order creation error:", error);
      res.status(500).json({ message: "خطا در ثبت سفارش" });
    }
  });

  // Create order from vitrin (uses items from request body, not cart)
  app.post("/api/orders/vitrin", authenticateToken, requireLevel2, async (req: AuthRequest, res) => {
    try {
      const { sellerId, addressId, shippingMethod, items, notes } = req.body;
      
      if (!items || items.length === 0) {
        return res.status(400).json({ message: "لیست محصولات خالی است" });
      }

      if (!sellerId) {
        return res.status(400).json({ message: "شناسه فروشنده الزامی است" });
      }

      // Calculate total amount
      let totalAmount = 0;
      for (const item of items) {
        totalAmount += parseFloat(item.totalPrice || item.unitPrice) * (item.quantity || 1);
      }

      // Get VAT settings
      const vatSettings = await storage.getVatSettings(sellerId);
      const vatPercentage = vatSettings?.isEnabled ? parseFloat(vatSettings.vatPercentage) : 0;
      const vatAmount = Math.round(totalAmount * (vatPercentage / 100));
      const totalWithVat = totalAmount + vatAmount;

      // Create order
      const order = await storage.createOrder({
        userId: req.user!.id,
        sellerId,
        totalAmount: totalWithVat.toString(),
        addressId: addressId || null,
        shippingMethod: shippingMethod || null,
        notes: notes || null
      });

      // Create order items
      for (const item of items) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice || (parseFloat(item.unitPrice) * (item.quantity || 1)).toString()
        });
      }

      // Generate and send invoice
      try {
        console.log(`🖼️ در حال تولید فاکتور برای سفارش ویترین ${order.id}...`);
        const invoiceUrl = await generateAndSaveInvoice(order.id);
        console.log(`✅ فاکتور ذخیره شد: ${invoiceUrl}`);
        
        const user = await storage.getUser(req.user!.id);
        if (user && user.whatsappNumber) {
          const success = await whatsAppSender.sendImage(
            user.whatsappNumber,
            `📄 فاکتور سفارش شما`,
            invoiceUrl,
            order.sellerId
          );
          
          if (success) {
            console.log(`✅ فاکتور با موفقیت به ${user.whatsappNumber} ارسال شد`);
          }
        }
      } catch (error) {
        console.error(`❌ خطا در تولید یا ارسال فاکتور:`, error);
      }

      res.status(201).json({ 
        message: "سفارش با موفقیت ثبت شد",
        orders: [order],
        id: order.id
      });
    } catch (error: any) {
      console.error("Vitrin order creation error:", error);
      res.status(500).json({ message: "خطا در ثبت سفارش" });
    }
  });

  // Update order status (only for sellers)
  app.put("/api/orders/:id/status", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      
      if (!['awaiting_payment', 'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "وضعیت نامعتبر" });
      }

      const updatedOrder = await storage.updateOrderStatus(req.params.id, status, req.user!.id);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "سفارش یافت نشد یا دسترسی ندارید" });
      }

      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "خطا در بروزرسانی وضعیت سفارش" });
    }
  });

  // Get order details with items
  app.get("/api/orders/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ message: "سفارش یافت نشد" });
      }

      // Check if user has access to this order
      if (req.user!.role === 'user_level_2' && order.userId !== req.user!.id) {
        return res.status(403).json({ message: "دسترسی به سفارش ندارید" });
      }
      
      if (req.user!.role === 'user_level_1' && order.sellerId !== req.user!.id) {
        return res.status(403).json({ message: "دسترسی به سفارش ندارید" });
      }

      const orderItems = await storage.getOrderItemsWithProducts(order.id);
      
      // دریافت تنظیمات VAT فروشنده
      const vatSettings = await storage.getVatSettings(order.sellerId);
      
      res.json({
        ...order,
        items: orderItems,
        vatSettings: vatSettings || { vatPercentage: "0", isEnabled: false }
      });
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت جزئیات سفارش" });
    }
  });

  // =================
  // TRANSACTION ROUTES
  // =================
  
  // Get user transactions
  app.get("/api/transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { type } = req.query;
      
      let transactions;
      let currentUserId = req.user!.id;
      
      // برای کاربران سطح ۱: تراکنش‌های خودشان + فرزندانشان
      if (req.user!.role === 'user_level_1') {
        // دریافت زیرمجموعه‌ها (فرزندان)
        const subUsers = await storage.getSubUsers(req.user!.id);
        const allUserIds = [req.user!.id, ...subUsers.map(user => user.id)];
        
        // دریافت تراکنش‌های تمام کاربران (خودش + فرزندان)
        const allTransactions = [];
        for (const userId of allUserIds) {
          if (type && typeof type === 'string') {
            const userTransactions = await storage.getTransactionsByUserAndType(userId, type);
            allTransactions.push(...userTransactions);
          } else {
            const userTransactions = await storage.getTransactionsByUser(userId);
            allTransactions.push(...userTransactions);
          }
        }
        
        // مرتب‌سازی بر اساس تاریخ ایجاد (جدیدترین اول)
        transactions = allTransactions.sort((a, b) => 
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
        );
      } 
      // برای سایر کاربران: فقط تراکنش‌های خودشان
      else {
        if (type && typeof type === 'string') {
          transactions = await storage.getTransactionsByUserAndType(req.user!.id, type);
        } else {
          transactions = await storage.getTransactionsByUser(req.user!.id);
        }
      }
      
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت تراکنش‌ها" });
    }
  });

  // Create new transaction (deposit/withdraw)
  app.post("/api/transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId: req.user!.id
      });

      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "داده‌های ورودی نامعتبر" });
      }
      res.status(500).json({ message: "خطا در ایجاد تراکنش" });
    }
  });

  // Get user balance
  app.get("/api/balance", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const balance = await storage.getUserBalance(req.user!.id);
      res.json({ balance });
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت موجودی" });
    }
  });

  // Get successful transactions for level 1 users (from their customers)
  app.get("/api/transactions/successful", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      // Get sub-users (level 2 customers)
      const subUsers = await storage.getSubUsers(req.user!.id);
      const subUserIds = subUsers.map(user => user.id);
      
      const transactions = await storage.getSuccessfulTransactionsBySellers([req.user!.id]);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت تراکنش‌های موفق" });
    }
  });

  // Update transaction status (for admin/level1 users)
  app.put("/api/transactions/:id/status", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      if (!status || !['pending', 'completed', 'failed'].includes(status)) {
        return res.status(400).json({ message: "وضعیت معتبر نیست" });
      }

      // Check if transaction exists and user has permission
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: "تراکنش یافت نشد" });
      }

      // For level_1 users, they can only update transactions of their sub-users or themselves
      if (req.user!.role === 'user_level_1') {
        const subUsers = await storage.getSubUsers(req.user!.id);
        const allowedUserIds = [req.user!.id, ...subUsers.map(user => user.id)];
        
        if (!allowedUserIds.includes(transaction.userId)) {
          return res.status(403).json({ message: "شما مجاز به تغییر این تراکنش نیستید" });
        }
      }

      // Update transaction status
      const updatedTransaction = await storage.updateTransactionStatus(id, status);
      if (!updatedTransaction) {
        return res.status(500).json({ message: "خطا در به‌روزرسانی تراکنش" });
      }

      // پردازش خودکار سفارشات در صورت تایید تراکنش واریزی
      if (status === 'completed' && transaction.type === 'deposit') {
        try {
          const transactionUser = await storage.getUser(transaction.userId);
          
          if (transactionUser) {
            // دریافت موجودی فعلی کاربر
            let currentBalance = await storage.getUserBalance(transaction.userId);
            
            // دریافت سفارشات در انتظار پرداخت (قدیمی‌ترین اول)
            const awaitingOrders = await storage.getAwaitingPaymentOrdersByUser(transaction.userId);
            
            // پردازش سفارشات به ترتیب اولویت
            for (const order of awaitingOrders) {
              const orderAmount = parseFloat(order.totalAmount);
              
              // چک کردن موجودی کافی
              if (currentBalance >= orderAmount) {
                // تغییر وضعیت سفارش به در انتظار تایید
                await storage.updateOrderStatus(order.id, 'pending', order.sellerId);
                
                // ثبت تراکنش کسر موجودی
                const { nanoid } = await import('nanoid');
                await storage.createTransaction({
                  userId: transaction.userId,
                  orderId: order.id,
                  type: 'order_payment',
                  amount: `-${orderAmount}`, // مقدار منفی برای کسر
                  status: 'completed',
                  transactionDate: new Date().toLocaleDateString('fa-IR'),
                  transactionTime: new Date().toLocaleTimeString('fa-IR'),
                  accountSource: 'موجودی کل',
                  referenceId: `OP-${nanoid(10)}`, // شماره پیگیری منحصر به فرد
                });
                
                // کم کردن از موجودی جاری
                currentBalance -= orderAmount;
                
                console.log(`✅ سفارش ${order.orderNumber} با موفقیت تایید شد - مبلغ: ${orderAmount} تومان`);
              } else {
                // موجودی کافی نیست، از حلقه خارج می‌شویم
                console.log(`⚠️ موجودی کافی برای پردازش سفارش ${order.orderNumber} نیست`);
                break;
              }
            }
          }
        } catch (autoProcessError) {
          console.error('خطا در پردازش خودکار سفارشات:', autoProcessError);
          // ادامه می‌دهیم تا پیام واتساپ ارسال شود
        }
      }

      // ارسال پیام واتساپ به کاربر در صورت تغییر به completed یا failed
      if (status === 'completed' || status === 'failed') {
        const transactionUser = await storage.getUser(transaction.userId);
        
        if (transactionUser?.whatsappNumber) {
          // تعیین کاربر ارسال‌کننده پیام (کاربر سطح 1 یا والد)
          const senderUserId = transaction.parentUserId || req.user!.id;
          
          // وارد کردن whatsAppMessageService
          const { whatsAppMessageService } = await import("./whatsapp-service");
          
          if (status === 'completed') {
            await whatsAppMessageService.sendTransactionApprovedMessage(
              transactionUser.whatsappNumber,
              senderUserId,
              updatedTransaction.amount
            );
          } else if (status === 'failed') {
            await whatsAppMessageService.sendTransactionRejectedMessage(
              transactionUser.whatsappNumber,
              senderUserId,
              updatedTransaction.amount
            );
          }
        }
      }

      res.json(updatedTransaction);
    } catch (error) {
      console.error("Error updating transaction status:", error);
      res.status(500).json({ message: "خطا در به‌روزرسانی وضعیت" });
    }
  });

  // DEPOSIT APPROVAL ROUTES
  // =======================

  // Get approved deposits total for level 1 user
  app.get("/api/deposits/summary", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const parentUserId = req.user!.id;
      const total = await storage.getApprovedDepositsTotalByParent(parentUserId);
      
      res.json({ 
        totalAmount: total,
        parentUserId 
      });
    } catch (error) {
      console.error("Error getting approved deposits summary:", error);
      res.status(500).json({ message: "خطا در دریافت خلاصه واریزی‌ها" });
    }
  });

  // Get deposits awaiting approval by parent
  app.get("/api/deposits", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const parentUserId = req.user!.id;
      const deposits = await storage.getDepositsByParent(parentUserId);
      
      res.json(deposits);
    } catch (error) {
      console.error("Error getting deposits:", error);
      res.status(500).json({ message: "خطا در دریافت درخواست‌های واریز" });
    }
  });

  // Approve deposit (for level 1 users)
  app.put("/api/deposits/:id/approve", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const approvedByUserId = req.user!.id;

      // Check if deposit exists and belongs to this parent
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: "درخواست واریز یافت نشد" });
      }

      // Verify this is a deposit and belongs to current user's children
      if (transaction.type !== 'deposit' || transaction.parentUserId !== approvedByUserId) {
        return res.status(403).json({ message: "شما مجاز به تایید این واریز نیستید" });
      }

      // Already approved
      if (transaction.status === 'completed' && transaction.approvedByUserId) {
        return res.status(400).json({ message: "این واریز قبلاً تایید شده است" });
      }

      // Approve the deposit
      const approvedDeposit = await storage.approveDeposit(id, approvedByUserId);
      if (!approvedDeposit) {
        return res.status(500).json({ message: "خطا در تایید واریز" });
      }

      res.json(approvedDeposit);
    } catch (error) {
      console.error("Error approving deposit:", error);
      res.status(500).json({ message: "خطا در تایید واریز" });
    }
  });

  // INTERNAL CHAT ROUTES
  // ====================

  // Get chat messages between user and their parent/child
  app.get("/api/internal-chats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      let chats;

      if (user.role === "user_level_2") {
        // Level 2 users chat with their parent (seller)
        if (!user.parentUserId) {
          return res.status(400).json({ message: "فروشنده‌ای برای شما تعین نشده است" });
        }
        chats = await storage.getInternalChatsBetweenUsers(user.id, user.parentUserId);
      } else if (user.role === "user_level_1") {
        // Level 1 users can see all their customers' chats OR chat with admin
        const admin = (await storage.getAllUsers()).find(u => u.role === "admin");
        const customerChats = await storage.getInternalChatsForSeller(user.id);
        const adminChats = admin ? await storage.getInternalChatsBetweenUsers(user.id, admin.id) : [];
        chats = [...customerChats, ...adminChats];
      } else {
        return res.status(403).json({ message: "دسترسی مجاز نیست" });
      }

      res.json(chats);
    } catch (error) {
      console.error("Error getting internal chats:", error);
      res.status(500).json({ message: "خطا در دریافت پیام‌ها" });
    }
  });

  // Send a new internal chat message
  app.post("/api/internal-chats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      // Allow both level 1 and level 2 users to send messages
      if (user.role !== "user_level_1" && user.role !== "user_level_2") {
        return res.status(403).json({ message: "فقط کاربران سطح ۱ و ۲ می‌توانند پیام ارسال کنند" });
      }

      const validatedData = insertInternalChatSchema.parse({
        ...req.body,
        senderId: user.id
      });

      // Validate sender-receiver relationship
      if (user.role === "user_level_2") {
        // Level 2 users can only send to their parent
        if (!user.parentUserId || validatedData.receiverId !== user.parentUserId) {
          return res.status(400).json({ message: "شما فقط می‌توانید با فروشنده خود چت کنید" });
        }
      } else if (user.role === "user_level_1") {
        // Level 1 users can send to their direct sub-users OR to admin
        const receiver = await storage.getUser(validatedData.receiverId);
        if (!receiver) {
          return res.status(404).json({ message: "گیرنده یافت نشد" });
        }
        
        const isAdmin = receiver.role === "admin";
        const isCustomer = receiver.parentUserId === user.id;
        
        if (!isAdmin && !isCustomer) {
          return res.status(400).json({ message: "شما فقط می‌توانید با مشتریان خود یا مدیر سیستم چت کنید" });
        }
      }

      const chat = await storage.createInternalChat(validatedData);
      res.status(201).json(chat);
    } catch (error: any) {
      console.error("Error creating internal chat:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "داده‌های ورودی نامعتبر" });
      }
      res.status(500).json({ message: "خطا در ارسال پیام" });
    }
  });

  // Mark chat messages as read
  app.patch("/api/internal-chats/:chatId/read", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { chatId } = req.params;
      const user = req.user!;

      // Verify user has access to this chat
      const chat = await storage.getInternalChatById(chatId);
      if (!chat) {
        return res.status(404).json({ message: "پیام یافت نشد" });
      }

      if (chat.senderId !== user.id && chat.receiverId !== user.id) {
        return res.status(403).json({ message: "دسترسی به این پیام مجاز نیست" });
      }

      // Only receiver can mark as read
      if (chat.receiverId !== user.id) {
        return res.status(400).json({ message: "فقط گیرنده پیام می‌تواند آن را خوانده شده علامت‌گذاری کند" });
      }

      await storage.markInternalChatAsRead(chatId);
      res.json({ message: "پیام خوانده شده علامت‌گذاری شد" });
    } catch (error) {
      console.error("Error marking chat as read:", error);
      res.status(500).json({ message: "خطا در علامت‌گذاری پیام" });
    }
  });

  // Get unread messages count for current user
  app.get("/api/internal-chats/unread-count", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      // Only allow level 1 and level 2 users
      if (user.role !== "user_level_1" && user.role !== "user_level_2") {
        return res.status(403).json({ message: "دسترسی محدود" });
      }

      const unreadCount = await storage.getUnreadMessagesCountForUser(user.id, user.role);
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error getting unread messages count:", error);
      res.status(500).json({ message: "خطا در دریافت تعداد پیام‌های خوانده نشده" });
    }
  });

  // Mark all messages as read for current user
  app.patch("/api/internal-chats/mark-all-read", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      // Only allow level 1 and level 2 users
      if (user.role !== "user_level_1" && user.role !== "user_level_2") {
        return res.status(403).json({ message: "دسترسی محدود" });
      }

      const success = await storage.markAllMessagesAsReadForUser(user.id, user.role);
      if (success) {
        res.json({ message: "تمام پیام‌ها خوانده شده علامت‌گذاری شدند" });
      } else {
        res.status(500).json({ message: "خطا در علامت‌گذاری پیام‌ها" });
      }
    } catch (error) {
      console.error("Error marking all messages as read:", error);
      res.status(500).json({ message: "خطا در علامت‌گذاری پیام‌ها" });
    }
  });

  // GUEST CHAT ROUTES
  // =================
  
  // Create or get guest chat session (no auth required)
  app.post("/api/guest-chat/session", async (req, res) => {
    try {
      const { sessionToken, guestName, guestPhone } = req.body;
      
      if (!sessionToken) {
        return res.status(400).json({ message: "توکن جلسه الزامی است" });
      }
      
      // دریافت IP آدرس مهمان
      const rawIpAddress = req.headers['x-forwarded-for'] as string || req.ip || 'Unknown';
      const guestIpAddress = typeof rawIpAddress === 'string' ? rawIpAddress.replace(/,\s*/g, '---') : rawIpAddress;
      
      // Check if session already exists
      let session = await storage.getGuestChatSessionByToken(sessionToken);
      
      if (!session) {
        // Create new session with IP address
        session = await storage.createGuestChatSession(sessionToken, guestName, guestPhone, guestIpAddress);
        
        // Send welcome message from admin
        await storage.createGuestChatMessage(session.id, "سلام! چطور می‌تونم کمکتون کنم؟", "admin");
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error creating guest chat session:", error);
      res.status(500).json({ message: "خطا در ایجاد جلسه چت" });
    }
  });
  
  // Get guest chat messages (no auth required)
  app.get("/api/guest-chat/:sessionToken/messages", async (req, res) => {
    try {
      const { sessionToken } = req.params;
      
      const session = await storage.getGuestChatSessionByToken(sessionToken);
      if (!session) {
        return res.status(404).json({ message: "جلسه چت یافت نشد" });
      }
      
      const messages = await storage.getGuestChatMessages(session.id);
      
      // Mark admin messages as read (guest is viewing)
      await storage.markGuestChatMessagesAsRead(session.id, "guest");
      
      res.json({ session, messages });
    } catch (error) {
      console.error("Error getting guest chat messages:", error);
      res.status(500).json({ message: "خطا در دریافت پیام‌ها" });
    }
  });
  
  // Send guest message (no auth required)
  app.post("/api/guest-chat/:sessionToken/messages", async (req, res) => {
    try {
      const { sessionToken } = req.params;
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "پیام نمی‌تواند خالی باشد" });
      }
      
      const session = await storage.getGuestChatSessionByToken(sessionToken);
      if (!session) {
        return res.status(404).json({ message: "جلسه چت یافت نشد" });
      }
      
      if (!session.isActive) {
        return res.status(400).json({ message: "این جلسه چت بسته شده است" });
      }
      
      const newMessage = await storage.createGuestChatMessage(session.id, message.trim(), "guest");
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error sending guest message:", error);
      res.status(500).json({ message: "خطا در ارسال پیام" });
    }
  });
  
  // ADMIN GUEST CHAT ROUTES (requires authentication)
  
  // Get all guest chat sessions (admin only)
  app.get("/api/admin/guest-chats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "فقط ادمین می‌تواند چت‌های مهمانان را مشاهده کند" });
      }
      
      const sessions = await storage.getAllGuestChatSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error getting guest chat sessions:", error);
      res.status(500).json({ message: "خطا در دریافت جلسات چت" });
    }
  });
  
  // Get active guest chat sessions (admin only)
  app.get("/api/admin/guest-chats/active", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "فقط ادمین می‌تواند چت‌های مهمانان را مشاهده کند" });
      }
      
      const sessions = await storage.getActiveGuestChatSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error getting active guest chat sessions:", error);
      res.status(500).json({ message: "خطا در دریافت جلسات چت فعال" });
    }
  });
  
  // Get total unread guest chats count (admin only)
  app.get("/api/admin/guest-chats/unread-count", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی محدود" });
      }
      
      const unreadCount = await storage.getTotalUnreadGuestChats();
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error getting unread guest chats count:", error);
      res.status(500).json({ message: "خطا در دریافت تعداد پیام‌های خوانده نشده" });
    }
  });
  
  // Get guest chat messages for admin
  app.get("/api/admin/guest-chats/:sessionId/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { sessionId } = req.params;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "فقط ادمین می‌تواند پیام‌ها را مشاهده کند" });
      }
      
      const messages = await storage.getGuestChatMessages(sessionId);
      
      // Mark guest messages as read (admin is viewing)
      await storage.markGuestChatMessagesAsRead(sessionId, "admin");
      
      res.json(messages);
    } catch (error) {
      console.error("Error getting guest chat messages for admin:", error);
      res.status(500).json({ message: "خطا در دریافت پیام‌ها" });
    }
  });
  
  // Send admin reply to guest chat
  app.post("/api/admin/guest-chats/:sessionId/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { sessionId } = req.params;
      const { message } = req.body;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "فقط ادمین می‌تواند پاسخ ارسال کند" });
      }
      
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "پیام نمی‌تواند خالی باشد" });
      }
      
      const newMessage = await storage.createGuestChatMessage(sessionId, message.trim(), "admin");
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error sending admin reply:", error);
      res.status(500).json({ message: "خطا در ارسال پاسخ" });
    }
  });
  
  // Close guest chat session (admin only)
  app.patch("/api/admin/guest-chats/:sessionId/close", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { sessionId } = req.params;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "فقط ادمین می‌تواند جلسه را ببندد" });
      }
      
      await storage.closeGuestChatSession(sessionId);
      res.json({ message: "جلسه چت با موفقیت بسته شد" });
    } catch (error) {
      console.error("Error closing guest chat session:", error);
      res.status(500).json({ message: "خطا در بستن جلسه چت" });
    }
  });

  // PROJECT ORDER REQUEST ROUTES
  // ============================
  
  // Create project order request (public - no auth required)
  app.post("/api/project-orders", async (req, res) => {
    try {
      const { firstName, lastName, phone, description } = req.body;
      
      if (!firstName || !lastName || !phone || !description) {
        return res.status(400).json({ message: "تمام فیلدها الزامی هستند" });
      }
      
      const request = await storage.createProjectOrderRequest({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        description: description.trim(),
      });
      
      res.status(201).json({ 
        message: "درخواست شما با موفقیت ثبت شد. به زودی با شما تماس می‌گیریم.",
        request 
      });
    } catch (error) {
      console.error("Error creating project order request:", error);
      res.status(500).json({ message: "خطا در ثبت درخواست. لطفا مجددا تلاش کنید." });
    }
  });
  
  // Get all project order requests (admin only)
  app.get("/api/admin/project-orders", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "فقط ادمین می‌تواند درخواست‌ها را مشاهده کند" });
      }
      
      const requests = await storage.getProjectOrderRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error getting project order requests:", error);
      res.status(500).json({ message: "خطا در دریافت درخواست‌ها" });
    }
  });
  
  // Get pending project order requests count (admin only)
  app.get("/api/admin/project-orders/pending-count", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      
      const requests = await storage.getProjectOrderRequests();
      const pendingCount = requests.filter(r => r.status === "pending").length;
      res.json({ pendingCount });
    } catch (error) {
      console.error("Error getting pending project orders count:", error);
      res.status(500).json({ message: "خطا در دریافت تعداد درخواست‌ها" });
    }
  });
  
  // Update project order request status (admin only)
  app.patch("/api/admin/project-orders/:id/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { status } = req.body;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "فقط ادمین می‌تواند وضعیت را تغییر دهد" });
      }
      
      if (!status) {
        return res.status(400).json({ message: "وضعیت جدید الزامی است" });
      }
      
      const validStatuses = ['pending', 'reviewed', 'contacted', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "وضعیت نامعتبر است" });
      }
      
      const updated = await storage.updateProjectOrderRequestStatus(id, status);
      if (!updated) {
        return res.status(404).json({ message: "درخواست یافت نشد" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating project order request status:", error);
      res.status(500).json({ message: "خطا در به‌روزرسانی وضعیت" });
    }
  });
  
  // Delete project order request (admin only)
  app.delete("/api/admin/project-orders/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role !== "admin") {
        return res.status(403).json({ message: "فقط ادمین می‌تواند درخواست را حذف کند" });
      }
      
      await storage.deleteProjectOrderRequest(id);
      res.json({ message: "درخواست با موفقیت حذف شد" });
    } catch (error) {
      console.error("Error deleting project order request:", error);
      res.status(500).json({ message: "خطا در حذف درخواست" });
    }
  });

  // Get user by ID (for getting parent info)
  app.get("/api/users/:userId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const user = req.user!;

      // Check permission: only admin, self, or parent/child relationship
      if (user.role !== "admin" && user.id !== userId) {
        // Check if it's parent-child relationship
        if (user.parentUserId !== userId && user.role !== "user_level_1") {
          return res.status(403).json({ message: "دسترسی مجاز نیست" });
        }
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      // Return limited info for security
      const safeUser = {
        id: targetUser.id,
        username: targetUser.username,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email,
        phone: targetUser.phone,
        role: targetUser.role,
        profilePicture: targetUser.profilePicture,
      };

      res.json(safeUser);
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ message: "خطا در دریافت اطلاعات کاربر" });
    }
  });

  // FAQ routes
  app.get("/api/faqs", async (req, res) => {
    try {
      const { includeInactive } = req.query;
      const faqs = await storage.getAllFaqs(includeInactive === 'true');
      res.json(faqs);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت سوالات متداول" });
    }
  });

  app.get("/api/faqs/active", async (req, res) => {
    try {
      const faqs = await storage.getActiveFaqs();
      res.json(faqs);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت سوالات متداول فعال" });
    }
  });

  app.get("/api/faqs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const faq = await storage.getFaq(id);
      if (!faq) {
        return res.status(404).json({ message: "سوال متداول یافت نشد" });
      }
      res.json(faq);
    } catch (error) {
      res.status(500).json({ message: "خطا در دریافت سوال متداول" });
    }
  });

  app.post("/api/faqs", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertFaqSchema.parse(req.body);
      const faq = await storage.createFaq(validatedData, req.user!.id);
      res.json(faq);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ایجاد سوال متداول" });
    }
  });

  app.put("/api/faqs/:id", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateFaqSchema.parse(req.body);
      
      const updatedFaq = await storage.updateFaq(id, validatedData);
      if (!updatedFaq) {
        return res.status(404).json({ message: "سوال متداول یافت نشد" });
      }
      
      res.json(updatedFaq);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "داده های ورودی نامعتبر است", errors: error.errors });
      }
      res.status(500).json({ message: "خطا در ویرایش سوال متداول" });
    }
  });

  app.delete("/api/faqs/:id", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFaq(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "سوال متداول یافت نشد" });
      }
      
      res.json({ message: "سوال متداول با موفقیت حذف شد" });
    } catch (error) {
      res.status(500).json({ message: "خطا در حذف سوال متداول" });
    }
  });

  app.put("/api/faqs/:id/order", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { order } = req.body;
      
      if (typeof order !== 'number') {
        return res.status(400).json({ message: "ترتیب باید عدد باشد" });
      }
      
      const updatedFaq = await storage.updateFaqOrder(id, order);
      if (!updatedFaq) {
        return res.status(404).json({ message: "سوال متداول یافت نشد" });
      }
      
      res.json(updatedFaq);
    } catch (error) {
      res.status(500).json({ message: "خطا در تغییر ترتیب سوال متداول" });
    }
  });

  // Save invoice for level 2 users
  app.post("/api/save-invoice", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId, imageData } = req.body;
      
      if (!orderId || !imageData) {
        return res.status(400).json({ message: "داده‌های فاکتور ناقص است" });
      }

      // دریافت اطلاعات سفارش برای گرفتن اطلاعات کاربر
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "سفارش یافت نشد" });
      }

      // دریافت اطلاعات کاربر
      const user = await storage.getUser(order.userId);
      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      // ایجاد پوشه invoice در صورت عدم وجود
      const invoiceDir = path.join(process.cwd(), 'invoice');
      if (!fs.existsSync(invoiceDir)) {
        fs.mkdirSync(invoiceDir, { recursive: true });
      }

      // استخراج داده تصویر از data URL
      const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // نام فایل یونیک با timestamp
      const timestamp = Date.now();
      const filename = `فاکتور-سفارش-${orderId}-${timestamp}.png`;
      const filepath = path.join(invoiceDir, filename);

      // ذخیره فایل
      fs.writeFileSync(filepath, imageBuffer);

      console.log(`✅ فاکتور کاربر سطح 2 ذخیره شد: ${filename}`);

      // ارسال فاکتور به واتس‌اپ کاربر (در صورت وجود شماره واتس‌اپ)
      if (user.whatsappNumber) {
        try {
          // دریافت توکن واتس‌اپ
          let whatsappToken: string | undefined;
          
          // اگر کاربر سطح 1 باشد و توکن خودش رو داشته باشه
          const seller = await storage.getUser(order.sellerId);
          if (seller?.role === 'user_level_1' && seller?.whatsappToken) {
            whatsappToken = seller.whatsappToken;
          } else {
            // استفاده از تنظیمات عمومی
            const settings = await storage.getWhatsappSettings();
            whatsappToken = settings?.token || undefined;
          }

          if (whatsappToken) {
            // ساخت URL عمومی برای فاکتور
            let publicUrl: string;
            
            if (process.env.REPLIT_DEV_DOMAIN) {
              publicUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/invoice/${encodeURIComponent(filename)}`;
            } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
              publicUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/invoice/${encodeURIComponent(filename)}`;
            } else {
              publicUrl = `http://localhost:5000/invoice/${encodeURIComponent(filename)}`;
            }

            // ارسال فاکتور به واتس‌اپ
            await whatsAppSender.sendWhatsAppImage(
              whatsappToken,
              user.whatsappNumber,
              `📄 فاکتور سفارش شما\n\nسفارش شماره: ${order.orderNumber || order.id.slice(0, 8)}\n\nفاکتور شما با موفقیت ارسال شد.`,
              publicUrl
            );

            console.log(`✅ فاکتور به واتس‌اپ ${user.whatsappNumber} ارسال شد`);
          } else {
            console.warn('⚠️ توکن واتس‌اپ موجود نیست، فاکتور ارسال نشد');
          }
        } catch (whatsappError: any) {
          console.error('❌ خطا در ارسال فاکتور به واتس‌اپ:', whatsappError.message);
          // ادامه می‌دهیم حتی اگر ارسال واتس‌اپ با خطا مواجه شود
        }
      } else {
        console.log('⚠️ کاربر شماره واتس‌اپ ندارد، فاکتور ارسال نشد');
      }

      res.json({ 
        message: "فاکتور با موفقیت ذخیره شد",
        filename: filename,
        path: filepath
      });
    } catch (error: any) {
      console.error("❌ خطا در ذخیره فاکتور:", error);
      res.status(500).json({ message: "خطا در ذخیره فاکتور", error: error.message });
    }
  });

  // Test endpoint for sending WhatsApp image
  app.post("/api/test/send-whatsapp-image", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user || !user.whatsappNumber) {
        return res.status(400).json({ message: "شماره واتساپ کاربر موجود نیست" });
      }

      // Get WhatsApp token
      let whatsappToken: string | undefined;
      
      if (user.role === 'user_level_1' && user.whatsappToken) {
        whatsappToken = user.whatsappToken;
      } else {
        // Use global settings for other users
        const settings = await storage.getWhatsappSettings();
        whatsappToken = settings?.token || undefined;
      }
      
      if (!whatsappToken) {
        return res.status(400).json({ message: "توکن واتساپ موجود نیست" });
      }

      // Test image URL (from Replit domain)
      const testImageUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/uploads/iphone15-pro-max.png`;
      
      console.log(`📤 ارسال تست عکس به ${user.whatsappNumber} با URL: ${testImageUrl}`);
      
      await whatsAppSender.sendWhatsAppImage(
        whatsappToken,
        user.whatsappNumber,
        '🧪 این یک عکس تستی است',
        testImageUrl
      );

      res.json({ 
        message: "عکس تست ارسال شد",
        phoneNumber: user.whatsappNumber,
        imageUrl: testImageUrl
      });
    } catch (error: any) {
      console.error("❌ خطا در ارسال عکس تست:", error);
      res.status(500).json({ message: "خطا در ارسال عکس تست", error: error.message });
    }
  });

  // Temporary file upload endpoint for WhatsApp messages
  app.post("/api/upload-temp", authenticateToken, uploadWhatsApp.single("file"), async (req: AuthRequest, res) => {
    try {
      if (!(req as any).file) {
        return res.status(400).json({ message: "فایل ارسال نشده است" });
      }

      const file = (req as any).file;
      const fileUrl = `/UploadsPicClienet/${file.filename}`;
      const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;

      res.json({
        url: fileUrl,
        fullUrl: fullUrl,
        filename: file.filename
      });
    } catch (error: any) {
      console.error("خطا در آپلود فایل:", error);
      res.status(500).json({ message: "خطا در آپلود فایل" });
    }
  });

  // Delete temporary file endpoint
  app.delete("/api/delete-temp/:filename", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const filename = req.params.filename;
      // بررسی هر دو پوشه برای حذف فایل
      const uploadPaths = [
        path.join(process.cwd(), "uploads", filename),
        path.join(process.cwd(), "UploadsPicClienet", filename)
      ];

      let fileDeleted = false;
      for (const filePath of uploadPaths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ فایل موقت حذف شد: ${filename}`);
          fileDeleted = true;
          break;
        }
      }

      if (fileDeleted) {
        res.json({ message: "فایل با موفقیت حذف شد" });
      } else {
        res.status(404).json({ message: "فایل یافت نشد" });
      }
    } catch (error: any) {
      console.error("خطا در حذف فایل:", error);
      res.status(500).json({ message: "خطا در حذف فایل" });
    }
  });

  // Shipping Settings routes - Only for user_level_1
  app.get("/api/shipping-settings", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const settings = await storage.getShippingSettings(req.user!.id);
      
      // اگر تنظیماتی وجود نداشت، مقادیر پیش‌فرض رو برگردون
      if (!settings) {
        return res.json({
          postPishtazEnabled: false,
          postNormalEnabled: false,
          piykEnabled: false,
          freeShippingEnabled: false,
          freeShippingMinAmount: null,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error getting shipping settings:", error);
      res.status(500).json({ message: "خطا در دریافت تنظیمات ترابری" });
    }
  });

  app.put("/api/shipping-settings", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const settings = await storage.updateShippingSettings(req.user!.id, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating shipping settings:", error);
      res.status(500).json({ message: "خطا در بروزرسانی تنظیمات ترابری" });
    }
  });

  // Get shipping settings for a specific seller (for level 2 users to see available options)
  app.get("/api/shipping-settings/:sellerId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sellerId } = req.params;
      const settings = await storage.getShippingSettings(sellerId);
      
      if (!settings) {
        return res.json({
          postPishtazEnabled: false,
          postNormalEnabled: false,
          piykEnabled: false,
          freeShippingEnabled: false,
          freeShippingMinAmount: null,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error getting seller shipping settings:", error);
      res.status(500).json({ message: "خطا در دریافت تنظیمات ترابری فروشنده" });
    }
  });

  // VAT Settings routes - Only for user_level_1
  app.get("/api/vat-settings", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      const settings = await storage.getVatSettings(req.user!.id);
      
      // اگر تنظیماتی وجود نداشت، مقادیر پیش‌فرض رو برگردون
      if (!settings) {
        return res.json({
          vatPercentage: "9",
          isEnabled: false,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error getting VAT settings:", error);
      res.status(500).json({ message: "خطا در دریافت تنظیمات ارزش افزوده" });
    }
  });

  app.put("/api/vat-settings", authenticateToken, requireAdminOrLevel1, async (req: AuthRequest, res) => {
    try {
      // اگر ارزش افزوده فعال است، تمام فیلدهای شرکت باید پر شوند
      if (req.body.isEnabled) {
        const requiredFields = ['companyName', 'address', 'phoneNumber', 'nationalId', 'economicCode'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
          return res.status(400).json({ 
            message: "هنگام فعال‌سازی ارزش افزوده، تمام فیلدهای اطلاعات شرکت باید پر شوند" 
          });
        }
      }
      
      const settings = await storage.updateVatSettings(req.user!.id, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating VAT settings:", error);
      res.status(500).json({ message: "خطا در بروزرسانی تنظیمات ارزش افزوده" });
    }
  });

  // Upload stamp image for VAT settings
  app.post("/api/vat-settings/upload-stamp", authenticateToken, requireAdminOrLevel1, uploadStamp.single('stampImage'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "فایلی آپلود نشده است" });
      }

      const stampImagePath = `/stamppic/${req.file.filename}`;
      
      // بروزرسانی تنظیمات VAT با مسیر عکس جدید
      await storage.updateVatSettings(req.user!.id, {
        stampImage: stampImagePath
      });

      res.json({ 
        message: "عکس مهر و امضا با موفقیت آپلود شد",
        stampImagePath 
      });
    } catch (error) {
      console.error("Error uploading stamp image:", error);
      res.status(500).json({ message: "خطا در آپلود عکس مهر و امضا" });
    }
  });

  // Get VAT settings for a specific seller (for level 2 users and reports)
  app.get("/api/vat-settings/:sellerId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sellerId } = req.params;
      const settings = await storage.getVatSettings(sellerId);
      
      if (!settings) {
        return res.json({
          vatPercentage: "9",
          isEnabled: false,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error getting VAT settings for seller:", error);
      res.status(500).json({ message: "خطا در دریافت تنظیمات ارزش افزوده" });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  
  // Serve WhatsApp chat images
  app.use("/UploadsPicClienet", express.static(path.join(process.cwd(), "UploadsPicClienet")));
  
  // Serve invoice files
  app.use("/invoice", express.static(path.join(process.cwd(), "invoice")));

  // ====== Database Backup & Restore Routes ======
  
  // Create and download database backup
  app.get("/api/admin/backup/create", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      // Create backups directory if it doesn't exist
      const backupsDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupFileName = `backup-${timestamp}.sql`;
      const backupFilePath = path.join(backupsDir, backupFileName);

      // Get database connection URL from environment
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return res.status(500).json({ message: "تنظیمات دیتابیس یافت نشد" });
      }

      // Execute pg_dump to create backup with --clean and --if-exists flags
      // This ensures the backup includes DROP statements for proper restoration
      try {
        await execAsync(`pg_dump --clean --if-exists "${databaseUrl}" > "${backupFilePath}"`);
        
        // Send file for download
        res.download(backupFilePath, backupFileName, (err) => {
          if (err) {
            console.error("Error downloading backup:", err);
          }
          // Optionally delete the file after download
          // fs.unlinkSync(backupFilePath);
        });
      } catch (error: any) {
        console.error("Error creating backup:", error);
        res.status(500).json({ 
          message: "خطا در ایجاد بک‌آپ",
          error: error.message 
        });
      }
    } catch (error) {
      console.error("Error in backup route:", error);
      res.status(500).json({ message: "خطا در ایجاد بک‌آپ دیتابیس" });
    }
  });

  // Multer configuration for backup file uploads
  const backup_storage_config = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(process.cwd(), "backups");
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  });

  const uploadBackup = multer({
    storage: backup_storage_config,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req: any, file: any, cb: any) => {
      if (file.originalname.endsWith('.sql')) {
        cb(null, true);
      } else {
        cb(new Error("فقط فایل‌های SQL مجاز هستند"));
      }
    },
  });

  // Restore database from backup file
  app.post("/api/admin/backup/restore", authenticateToken, uploadBackup.single('backupFile'), async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "فایل بک‌آپ ارسال نشده است" });
      }

      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      const backupFilePath = req.file.path;
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        return res.status(500).json({ message: "تنظیمات دیتابیس یافت نشد" });
      }

      // Execute psql to restore backup
      try {
        await execAsync(`psql "${databaseUrl}" < "${backupFilePath}"`);
        
        res.json({ 
          message: "بک‌آپ با موفقیت بازیابی شد",
          filename: req.file.originalname
        });
      } catch (error: any) {
        console.error("Error restoring backup:", error);
        res.status(500).json({ 
          message: "خطا در بازیابی بک‌آپ",
          error: error.message 
        });
      }
    } catch (error) {
      console.error("Error in restore route:", error);
      res.status(500).json({ message: "خطا در بازیابی بک‌آپ دیتابیس" });
    }
  });

  // Get list of available backups
  app.get("/api/admin/backup/list", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const backupsDir = path.join(process.cwd(), "backups");
      
      if (!fs.existsSync(backupsDir)) {
        return res.json({ backups: [] });
      }

      const files = fs.readdirSync(backupsDir);
      const backups = files
        .filter(file => file.endsWith('.sql'))
        .map(file => {
          const filePath = path.join(backupsDir, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json({ backups });
    } catch (error) {
      console.error("Error listing backups:", error);
      res.status(500).json({ message: "خطا در دریافت لیست بک‌آپ‌ها" });
    }
  });

  // Download a specific backup file
  app.get("/api/admin/backup/:filename/download", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const { filename } = req.params;
      
      // Security check: ensure filename doesn't contain path separators
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return res.status(400).json({ message: "نام فایل نامعتبر است" });
      }

      // Ensure filename ends with .sql
      if (!filename.endsWith('.sql')) {
        return res.status(400).json({ message: "فقط فایل‌های SQL مجاز هستند" });
      }

      const backupsDir = path.resolve(process.cwd(), "backups");
      const requestedFilePath = path.resolve(backupsDir, filename);

      // Security check: verify the resolved path is still inside backups directory
      if (!requestedFilePath.startsWith(backupsDir + path.sep)) {
        return res.status(400).json({ message: "دسترسی به فایل غیرمجاز است" });
      }

      if (!fs.existsSync(requestedFilePath)) {
        return res.status(404).json({ message: "فایل بک‌آپ یافت نشد" });
      }

      // Send file for download
      res.download(requestedFilePath, filename, (err) => {
        if (err) {
          console.error("Error downloading backup file:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "خطا در دانلود فایل بک‌آپ" });
          }
        }
      });
    } catch (error) {
      console.error("Error downloading backup file:", error);
      res.status(500).json({ message: "خطا در دانلود فایل بک‌آپ" });
    }
  });

  // Delete a backup file
  app.delete("/api/admin/backup/:filename", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const { filename } = req.params;
      
      // Security check: ensure filename doesn't contain path separators
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return res.status(400).json({ message: "نام فایل نامعتبر است" });
      }

      // Ensure filename ends with .sql
      if (!filename.endsWith('.sql')) {
        return res.status(400).json({ message: "فقط فایل‌های SQL مجاز هستند" });
      }

      const backupsDir = path.resolve(process.cwd(), "backups");
      const requestedFilePath = path.resolve(backupsDir, filename);

      // Security check: verify the resolved path is still inside backups directory
      if (!requestedFilePath.startsWith(backupsDir + path.sep)) {
        return res.status(400).json({ message: "دسترسی به فایل غیرمجاز است" });
      }

      if (!fs.existsSync(requestedFilePath)) {
        return res.status(404).json({ message: "فایل بک‌آپ یافت نشد" });
      }

      fs.unlinkSync(requestedFilePath);
      res.json({ message: "بک‌آپ با موفقیت حذف شد" });
    } catch (error) {
      console.error("Error deleting backup:", error);
      res.status(500).json({ message: "خطا در حذف بک‌آپ" });
    }
  });

  // ====== Maintenance Mode Routes ======
  
  // Get maintenance mode status (no authentication - public endpoint)
  app.get("/api/maintenance/status", async (req, res) => {
    try {
      const [status] = await db.select().from(maintenanceMode).limit(1);
      
      if (!status) {
        // Create default record if doesn't exist
        const [newStatus] = await db.insert(maintenanceMode).values({
          isEnabled: false
        }).returning();
        return res.json({ isEnabled: false });
      }
      
      res.json({ isEnabled: status.isEnabled });
    } catch (error) {
      console.error("Error getting maintenance status:", error);
      res.status(500).json({ message: "خطا در دریافت وضعیت" });
    }
  });

  // Toggle maintenance mode (admin only)
  app.post("/api/admin/maintenance/toggle", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const { isEnabled } = req.body;

      const [status] = await db.select().from(maintenanceMode).limit(1);
      
      if (!status) {
        // Create new record
        const [newStatus] = await db.insert(maintenanceMode).values({
          isEnabled: isEnabled
        }).returning();
        return res.json(newStatus);
      }
      
      // Update existing record
      const [updated] = await db
        .update(maintenanceMode)
        .set({ 
          isEnabled: isEnabled,
          updatedAt: new Date()
        })
        .where(eq(maintenanceMode.id, status.id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      res.status(500).json({ message: "خطا در تغییر وضعیت" });
    }
  });

  // Content Management API endpoints
  // Get all content sections
  app.get("/api/content-sections", async (req: Request, res: Response) => {
    try {
      const { contentSections } = await import("@shared/schema");
      const sections = await db.select().from(contentSections).orderBy(contentSections.createdAt);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching content sections:", error);
      res.status(500).json({ message: "خطا در دریافت محتوا" });
    }
  });

  // Get content section by key
  app.get("/api/content-sections/:key", async (req: Request, res: Response) => {
    try {
      const { contentSections } = await import("@shared/schema");
      const [section] = await db
        .select()
        .from(contentSections)
        .where(eq(contentSections.sectionKey, req.params.key))
        .limit(1);
      
      if (!section) {
        return res.status(404).json({ message: "بخش مورد نظر یافت نشد" });
      }
      
      res.json(section);
    } catch (error) {
      console.error("Error fetching content section:", error);
      res.status(500).json({ message: "خطا در دریافت محتوا" });
    }
  });

  // Create or update content section (admin only)
  app.post("/api/admin/content-sections", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const { contentSections, insertContentSectionSchema } = await import("@shared/schema");
      const validated = insertContentSectionSchema.parse(req.body);
      
      // Check if section with this key already exists
      const [existing] = await db
        .select()
        .from(contentSections)
        .where(eq(contentSections.sectionKey, validated.sectionKey))
        .limit(1);
      
      if (existing) {
        // Update existing section
        const [updated] = await db
          .update(contentSections)
          .set({
            ...validated,
            updatedAt: new Date()
          })
          .where(eq(contentSections.id, existing.id))
          .returning();
        
        return res.json(updated);
      }
      
      // Create new section
      const [created] = await db
        .insert(contentSections)
        .values(validated)
        .returning();
      
      res.json(created);
    } catch (error) {
      console.error("Error saving content section:", error);
      res.status(500).json({ message: "خطا در ذخیره محتوا" });
    }
  });

  // Update content section (admin only)
  app.put("/api/admin/content-sections/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const { contentSections, updateContentSectionSchema } = await import("@shared/schema");
      const validated = updateContentSectionSchema.parse({ ...req.body, id: req.params.id });
      
      const [updated] = await db
        .update(contentSections)
        .set({
          ...validated,
          updatedAt: new Date()
        })
        .where(eq(contentSections.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "بخش مورد نظر یافت نشد" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating content section:", error);
      res.status(500).json({ message: "خطا در به‌روزرسانی محتوا" });
    }
  });

  // Delete content section (admin only)
  app.delete("/api/admin/content-sections/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const { contentSections } = await import("@shared/schema");
      
      const [deleted] = await db
        .delete(contentSections)
        .where(eq(contentSections.id, req.params.id))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ message: "بخش مورد نظر یافت نشد" });
      }
      
      res.json({ message: "بخش با موفقیت حذف شد" });
    } catch (error) {
      console.error("Error deleting content section:", error);
      res.status(500).json({ message: "خطا در حذف محتوا" });
    }
  });

  // TRON Wallet Routes
  app.get("/api/tron/wallet", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'user_level_1') {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      res.json({ 
        walletAddress: user.tronWalletAddress || null,
        usdtWalletAddress: user.usdtTrc20WalletAddress || null,
        rippleWalletAddress: user.rippleWalletAddress || null,
        cardanoWalletAddress: user.cardanoWalletAddress || null
      });
    } catch (error) {
      console.error("خطا در دریافت آدرس ولت:", error);
      res.status(500).json({ message: "خطا در دریافت آدرس ولت" });
    }
  });

  app.put("/api/tron/wallet", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'user_level_1') {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const { walletAddress, usdtWalletAddress, rippleWalletAddress, cardanoWalletAddress } = req.body;

      // حداقل یک آدرس باید وارد شود
      if (!walletAddress?.trim() && !usdtWalletAddress?.trim() && 
          !rippleWalletAddress?.trim() && !cardanoWalletAddress?.trim()) {
        return res.status(400).json({ message: "حداقل یک آدرس ولت را وارد کنید" });
      }

      // اعتبارسنجی آدرس ترون در صورت وجود
      if (walletAddress && walletAddress.trim() && !tronService.validateTronAddress(walletAddress)) {
        return res.status(400).json({ message: "آدرس ولت TRON معتبر نیست" });
      }

      // اعتبارسنجی آدرس USDT TRC20 در صورت وجود (همان فرمت TRON)
      if (usdtWalletAddress && usdtWalletAddress.trim() && !tronService.validateTronAddress(usdtWalletAddress)) {
        return res.status(400).json({ message: "آدرس ولت USDT TRC20 معتبر نیست" });
      }

      const updateData: any = {};
      if (walletAddress !== undefined) updateData.tronWalletAddress = walletAddress.trim() || null;
      if (usdtWalletAddress !== undefined) updateData.usdtTrc20WalletAddress = usdtWalletAddress.trim() || null;
      if (rippleWalletAddress !== undefined) updateData.rippleWalletAddress = rippleWalletAddress.trim() || null;
      if (cardanoWalletAddress !== undefined) updateData.cardanoWalletAddress = cardanoWalletAddress.trim() || null;

      const updatedUser = await storage.updateUser(req.user!.id, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      res.json({ 
        message: "آدرس ولت با موفقیت ذخیره شد",
        walletAddress: updatedUser.tronWalletAddress 
      });
    } catch (error) {
      console.error("خطا در ذخیره آدرس ولت:", error);
      res.status(500).json({ message: "خطا در ذخیره آدرس ولت" });
    }
  });

  app.get("/api/tron/transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'user_level_1') {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user || !user.tronWalletAddress) {
        return res.status(400).json({ 
          message: "لطفاً ابتدا آدرس ولت خود را ثبت کنید" 
        });
      }

      const type = (req.query.type as string) || 'all';
      const limit = parseInt(req.query.limit as string) || 50;

      const transactions = await tronService.getTransactions(
        user.tronWalletAddress,
        type as 'all' | 'incoming' | 'outgoing',
        limit
      );

      // Get TRX price in Rial
      const trxPriceInRial = await tgjuService.getTronPriceInRial();

      res.json({ 
        success: true,
        walletAddress: user.tronWalletAddress,
        transactions,
        count: transactions.length,
        trxPriceInRial
      });
    } catch (error: any) {
      console.error("خطا در دریافت تراکنش‌ها:", error);
      res.status(500).json({ 
        message: error.message || "خطا در دریافت تراکنش‌ها",
        success: false
      });
    }
  });

  // Get current TRX price in Rial
  app.get("/api/tron/price", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'user_level_1') {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const priceInRial = await tgjuService.getTronPriceInRial();

      res.json({ 
        success: true,
        priceInRial,
        lastUpdate: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("خطا در دریافت قیمت ترون:", error);
      res.status(500).json({ 
        message: error.message || "خطا در دریافت قیمت ترون",
        success: false
      });
    }
  });

  // Get all crypto prices in Rial (Test endpoint - public)
  app.get("/api/crypto/prices/test", async (req: Request, res: Response) => {
    try {
      console.log('🧪 [TEST] درخواست دریافت قیمت‌های تستی...');
      const prices = await tgjuService.getAllCryptoPrices();
      console.log('🧪 [TEST] قیمت‌های دریافت شده:', JSON.stringify(prices, null, 2));

      res.json({ 
        success: true,
        prices,
        lastUpdate: new Date().toISOString(),
        message: 'این یک endpoint تستی است برای بررسی قیمت‌های زنده'
      });
    } catch (error: any) {
      console.error("❌ [TEST] خطا در دریافت قیمت‌های ارز:", error);
      res.status(500).json({ 
        message: error.message || "خطا در دریافت قیمت‌های ارز",
        success: false,
        error: error.stack
      });
    }
  });

  // Get all crypto prices in Rial (from cache)
  app.get("/api/crypto/prices", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Allow both level 1 and level 2 users to see crypto prices
      if (req.user!.role !== 'user_level_1' && req.user!.role !== 'user_level_2') {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const cachedPrices = await cryptoPriceCacheService.getCachedPrices();

      if (!cachedPrices) {
        return res.status(503).json({ 
          message: "قیمت‌ها هنوز آماده نیستند. لطفاً چند لحظه صبر کنید.",
          success: false
        });
      }

      res.json({ 
        success: true,
        prices: {
          TRX: cachedPrices.TRX,
          USDT: cachedPrices.USDT,
          XRP: cachedPrices.XRP,
          ADA: cachedPrices.ADA,
        },
        lastUpdate: cachedPrices.lastUpdate?.toISOString() || new Date().toISOString()
      });
    } catch (error: any) {
      console.error("خطا در دریافت قیمت‌های ارز:", error);
      res.status(500).json({ 
        message: error.message || "خطا در دریافت قیمت‌های ارز",
        success: false
      });
    }
  });

  app.get("/api/tron/transactions/trc20", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'user_level_1') {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user || !user.usdtTrc20WalletAddress) {
        return res.status(400).json({ 
          message: "لطفاً ابتدا آدرس ولت USDT TRC20 خود را ثبت کنید" 
        });
      }

      const contractAddress = (req.query.contract as string) || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      const limit = parseInt(req.query.limit as string) || 50;

      const transactions = await tronService.getTRC20Transactions(
        user.usdtTrc20WalletAddress,
        contractAddress,
        limit
      );

      res.json({ 
        success: true,
        walletAddress: user.usdtTrc20WalletAddress,
        transactions,
        count: transactions.length
      });
    } catch (error: any) {
      console.error("خطا در دریافت تراکنش‌های USDT TRC20:", error);
      res.status(500).json({ 
        message: error.message || "خطا در دریافت تراکنش‌های USDT TRC20",
        success: false
      });
    }
  });

  // Ripple (XRP) Transactions
  app.get("/api/ripple/transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'user_level_1') {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user || !user.rippleWalletAddress) {
        return res.status(400).json({ 
          message: "لطفاً ابتدا آدرس ولت Ripple خود را ثبت کنید" 
        });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const signedMarker = req.query.marker as string | undefined;

      const result = await rippleService.getTransactions(
        user.rippleWalletAddress,
        limit,
        signedMarker
      );

      res.json({ 
        success: true,
        walletAddress: user.rippleWalletAddress,
        transactions: result.transactions,
        count: result.transactions.length,
        ...(result.marker && { marker: result.marker })
      });
    } catch (error: any) {
      console.error("خطا در دریافت تراکنش‌های Ripple:", error);
      res.status(500).json({ 
        message: error.message || "خطا در دریافت تراکنش‌های Ripple",
        success: false
      });
    }
  });

  // Cardano (ADA) Transactions
  app.get("/api/cardano/transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'user_level_1') {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user || !user.cardanoWalletAddress) {
        return res.status(400).json({ 
          message: "لطفاً ابتدا آدرس ولت Cardano خود را ثبت کنید" 
        });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const page = parseInt(req.query.page as string) || 1;

      const transactions = await cardanoService.getTransactions(
        user.cardanoWalletAddress,
        limit,
        page
      );

      res.json({ 
        success: true,
        walletAddress: user.cardanoWalletAddress,
        transactions,
        count: transactions.length
      });
    } catch (error: any) {
      console.error("خطا در دریافت تراکنش‌های Cardano:", error);
      res.status(500).json({ 
        message: error.message || "خطا در دریافت تراکنش‌های Cardano",
        success: false
      });
    }
  });

  // Save Crypto Transaction
  app.post("/api/crypto-transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId, cryptoType, cryptoAmount, tomanEquivalent, transactionDate } = req.body;
      
      if (!orderId || !cryptoType || !cryptoAmount || !tomanEquivalent || !transactionDate) {
        return res.status(400).json({ 
          message: "تمام فیلدها الزامی هستند" 
        });
      }

      // Get the order to find the seller
      const order = await db.query.orders.findFirst({
        where: (o, { eq }) => eq(o.id, orderId)
      });

      if (!order) {
        return res.status(404).json({ 
          message: "سفارش یافت نشد" 
        });
      }

      // Get the SELLER's information (not the buyer) to get wallet address
      const seller = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, order.sellerId)
      });

      if (!seller) {
        return res.status(404).json({ 
          message: "فروشنده یافت نشد" 
        });
      }

      // Get wallet address from SELLER based on crypto type
      let finalWalletAddress = null;
      switch(cryptoType) {
        case 'TRX':
          finalWalletAddress = seller.tronWalletAddress || null;
          break;
        case 'USDT':
          finalWalletAddress = seller.usdtTrc20WalletAddress || null;
          break;
        case 'XRP':
          finalWalletAddress = seller.rippleWalletAddress || null;
          break;
        case 'ADA':
          finalWalletAddress = seller.cardanoWalletAddress || null;
          break;
      }

      console.log(`[Crypto Transaction] Creating transaction - Order: ${orderId}, Seller: ${seller.username}, CryptoType: ${cryptoType}, WalletAddress: ${finalWalletAddress}`);

      const cryptoTransaction = await db.insert(cryptoTransactions).values({
        orderId,
        userId: req.user!.id,
        cryptoType,
        cryptoAmount: String(cryptoAmount),
        tomanEquivalent: String(tomanEquivalent),
        transactionDate,
        walletAddress: finalWalletAddress,
      }).returning();

      // تراکنش جدید فعال شد - سرویس مطابقت را فعال کن
      await cryptoMatchingService.checkForActiveTransactionsAndStart();

      res.json({ 
        success: true,
        message: "تراکنش ارز دیجیتال با موفقیت ثبت شد",
        transaction: cryptoTransaction[0]
      });
    } catch (error: any) {
      console.error("خطا در ثبت تراکنش ارز دیجیتال:", error);
      res.status(500).json({ 
        message: error.message || "خطا در ثبت تراکنش ارز دیجیتال",
        success: false
      });
    }
  });

  // Get Crypto Transactions for an Order
  app.get("/api/orders/:orderId/crypto-transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;
      
      const transactions = await db.query.cryptoTransactions.findMany({
        where: (t, { eq, and }) => and(
          eq(t.orderId, orderId),
          eq(t.userId, req.user!.id)
        ),
        orderBy: (t, { desc }) => desc(t.registeredAt),
      });

      res.json({ 
        success: true,
        transactions: transactions || []
      });
    } catch (error: any) {
      console.error("خطا در دریافت تراکنش‌های ارز دیجیتال:", error);
      res.status(500).json({ 
        message: error.message || "خطا در دریافت تراکنش‌های ارز دیجیتال",
        success: false,
        transactions: []
      });
    }
  });

  // Delete Crypto Transaction
  app.delete("/api/crypto-transactions/:transactionId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { transactionId } = req.params;
      
      await db.delete(cryptoTransactions)
        .where(and(eq(cryptoTransactions.id, transactionId), eq(cryptoTransactions.userId, req.user!.id)));

      res.json({ 
        success: true,
        message: "تراکنش ارز دیجیتال با موفقیت حذف شد",
      });
    } catch (error: any) {
      console.error("خطا در حذف تراکنش ارز دیجیتال:", error);
      res.status(500).json({ 
        message: error.message || "خطا در حذف تراکنش ارز دیجیتال",
        success: false
      });
    }
  });

  // =================
  // VITRIN ROUTES (ویترین فروشگاه شخصی)
  // =================

  // Get AI settings for vitrin frontend (public - for frontend AI usage)
  app.get("/api/vitrin-ai-settings", async (req, res) => {
    try {
      const liaraSettings = await storage.getAiTokenSettings("liara");
      
      if (!liaraSettings?.token || !liaraSettings.isActive) {
        return res.status(404).json({ message: "تنظیمات AI در دسترس نیست" });
      }

      res.json({
        token: liaraSettings.token,
        baseUrl: (liaraSettings as any).workspaceId || "",
        model: liaraSettings.model || "google/gemini-2.0-flash-001",
      });
    } catch (error) {
      console.error("Error getting AI settings:", error);
      res.status(500).json({ message: "خطا در دریافت تنظیمات AI" });
    }
  });

  // Get seller's vitrin info (public)
  app.get("/api/vitrin/:username", async (req, res) => {
    try {
      const { username } = req.params;
      
      const seller = await storage.getUserByUsername(username);
      
      if (!seller || seller.role !== "user_level_1") {
        return res.status(404).json({ message: "فروشگاه یافت نشد" });
      }

      res.json({
        id: seller.id,
        username: seller.username,
        storeName: seller.storeName || `فروشگاه ${seller.firstName}`,
        storeDescription: seller.storeDescription || "",
        storeLogo: seller.storeLogo || seller.profilePicture,
        firstName: seller.firstName,
        lastName: seller.lastName,
        bankCardNumber: seller.bankCardNumber || null,
        bankCardHolderName: seller.bankCardHolderName || null,
      });
    } catch (error) {
      console.error("Error getting vitrin info:", error);
      res.status(500).json({ message: "خطا در دریافت اطلاعات فروشگاه" });
    }
  });

  // Get seller's products (public)
  app.get("/api/vitrin/:username/products", async (req, res) => {
    try {
      const { username } = req.params;
      
      const seller = await storage.getUserByUsername(username);
      
      if (!seller || seller.role !== "user_level_1") {
        return res.status(404).json({ message: "فروشگاه یافت نشد" });
      }

      const products = await storage.getProductsByUser(seller.id);
      const activeProducts = products.filter((p: any) => p.isActive);

      res.json(activeProducts);
    } catch (error) {
      console.error("Error getting vitrin products:", error);
      res.status(500).json({ message: "خطا در دریافت محصولات" });
    }
  });

  // Get seller's categories (public)
  app.get("/api/vitrin/:username/categories", async (req, res) => {
    try {
      const { username } = req.params;
      
      const seller = await storage.getUserByUsername(username);
      
      if (!seller || seller.role !== "user_level_1") {
        return res.status(404).json({ message: "فروشگاه یافت نشد" });
      }

      const categories = await storage.getAllCategories(seller.id, seller.role);
      const activeCategories = categories.filter((c: any) => c.isActive);

      res.json(activeCategories);
    } catch (error) {
      console.error("Error getting vitrin categories:", error);
      res.status(500).json({ message: "خطا در دریافت دسته‌بندی‌ها" });
    }
  });

  // Send message to seller via vitrin chat (public)
  app.post("/api/vitrin/:username/chat", async (req, res) => {
    try {
      const { username } = req.params;
      const { sessionToken, message, guestName, guestPhone } = req.body;
      
      if (!sessionToken || !message?.trim()) {
        return res.status(400).json({ message: "توکن جلسه و پیام الزامی است" });
      }
      
      // Validate session token belongs to this seller (format: vitrin_sellerId_timestamp_random)
      if (!sessionToken.startsWith(`vitrin_${username}_`)) {
        return res.status(403).json({ message: "توکن جلسه معتبر نیست" });
      }
      
      const seller = await storage.getUserByUsername(username);
      
      if (!seller || seller.role !== "user_level_1") {
        return res.status(404).json({ message: "فروشگاه یافت نشد" });
      }

      // Get IP address
      const rawIpAddress = req.headers['x-forwarded-for'] as string || req.ip || 'Unknown';
      const guestIpAddress = typeof rawIpAddress === 'string' ? rawIpAddress.replace(/,\s*/g, '---') : rawIpAddress;

      // Check if session already exists
      let session = await storage.getGuestChatSessionByToken(sessionToken);
      
      if (!session) {
        // Create new session with seller as target
        session = await storage.createGuestChatSession(sessionToken, guestName, guestPhone, guestIpAddress);
      }

      // Create the message
      const newMessage = await storage.createGuestChatMessage(session.id, message.trim(), "guest");
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error sending vitrin chat message:", error);
      res.status(500).json({ message: "خطا در ارسال پیام" });
    }
  });

  // Get vitrin chat messages (public)
  app.get("/api/vitrin/:username/chat/:sessionToken", async (req, res) => {
    try {
      const { username, sessionToken } = req.params;
      
      // Validate session token belongs to this seller (format: vitrin_sellerId_timestamp_random)
      if (!sessionToken.startsWith(`vitrin_${username}_`)) {
        return res.status(403).json({ message: "توکن جلسه معتبر نیست" });
      }
      
      const seller = await storage.getUserByUsername(username);
      
      if (!seller || seller.role !== "user_level_1") {
        return res.status(404).json({ message: "فروشگاه یافت نشد" });
      }

      const session = await storage.getGuestChatSessionByToken(sessionToken);
      if (!session) {
        return res.status(404).json({ message: "جلسه چت یافت نشد" });
      }

      const messages = await storage.getGuestChatMessages(session.id);
      
      // Mark admin messages as read
      await storage.markGuestChatMessagesAsRead(session.id, "guest");

      res.json({ session, messages });
    } catch (error) {
      console.error("Error getting vitrin chat messages:", error);
      res.status(500).json({ message: "خطا در دریافت پیام‌ها" });
    }
  });

  // AI Chat for vitrin (public) - Gemini AI integration
  app.post("/api/vitrin/:username/ai-chat", async (req, res) => {
    try {
      const { username } = req.params;
      const { message } = req.body;
      
      if (!message?.trim()) {
        return res.status(400).json({ response: "لطفاً پیام خود را وارد کنید." });
      }
      
      // Input length validation (prevent prompt injection with very long messages)
      const trimmedMessage = message.trim().slice(0, 2000);
      
      const seller = await storage.getUserByUsername(username);
      
      if (!seller || seller.role !== "user_level_1") {
        return res.status(404).json({ response: "فروشگاه یافت نشد." });
      }

      // Import AI service dynamically
      const { aiService } = await import("./ai-service");
      
      // Get seller's products for context (even if AI is inactive, for fallback)
      const products = await storage.getProductsByUser(seller.id);
      const storeName = seller.storeName || `فروشگاه ${seller.firstName}`;
      
      if (!aiService.isActive()) {
        // Fallback response when AI is not active
        const productNames = products.slice(0, 5).map((p: any) => p.name).join("، ");
        return res.json({ 
          response: `سلام! به ${storeName} خوش آمدید. 🌟\n\nمتأسفانه دستیار هوشمند ما در حال حاضر در دسترس نیست.\n\n${productNames ? `محصولات پرفروش ما: ${productNames}` : ""}\n\nبرای کسب اطلاعات بیشتر می‌توانید محصولات را در تب "ویترین" مشاهده کنید.`
        });
      }

      // Create context for AI with product info
      const productList = products.slice(0, 10).map((p: any) => `- ${p.name}: ${p.priceAfterDiscount || p.priceBeforeDiscount} تومان`).join("\n");
      
      const systemContext = `شما دستیار هوشمند فروشگاه "${storeName}" هستید. وظیفه شما کمک به مشتریان و پاسخ به سوالات آنها درباره محصولات و خدمات فروشگاه است.

محصولات موجود در فروشگاه:
${productList || "در حال حاضر محصولی ثبت نشده است."}

لطفاً به زبان فارسی و با لحن صمیمی و حرفه‌ای پاسخ دهید. پاسخ‌ها را کوتاه و مفید نگه دارید. اگر سوالی خارج از حیطه فروشگاه پرسیده شد، مودبانه کاربر را راهنمایی کنید.`;

      const fullMessage = `${systemContext}\n\nپیام مشتری: ${trimmedMessage}`;
      
      try {
        const aiResponse = await aiService.generateResponse(fullMessage, seller.id);
        res.json({ response: aiResponse });
      } catch (aiError) {
        console.error("AI response error:", aiError);
        res.json({ 
          response: `متشکرم از پیام شما! 🙏\n\nدر حال حاضر نمی‌توانم پاسخ مناسبی ارائه دهم. لطفاً محصولات ما را در تب "ویترین" مشاهده کنید یا بعداً دوباره تلاش کنید.`
        });
      }
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.json({ response: "متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید." });
    }
  });

  // Quick registration for vitrin customers (public)
  app.post("/api/vitrin/:username/quick-register", async (req, res) => {
    try {
      const { username } = req.params;
      const { phone, password } = req.body;
      
      if (!phone?.trim() || !password?.trim()) {
        return res.status(400).json({ message: "لطفاً شماره تلفن و رمز عبور را وارد کنید" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "رمز عبور باید حداقل ۶ کاراکتر باشد" });
      }
      
      const seller = await storage.getUserByUsername(username);
      
      if (!seller || seller.role !== "user_level_1") {
        return res.status(404).json({ message: "فروشگاه یافت نشد" });
      }
      
      const normalizedPhone = phone.trim().startsWith('98') 
        ? '0' + phone.trim().substring(2) 
        : phone.trim();
      
      const existingUser = await storage.getUserByUsername(normalizedPhone);
      if (existingUser) {
        const isPasswordValid = await bcrypt.compare(password, existingUser.password || '');
        if (isPasswordValid) {
          const token = jwt.sign({ userId: existingUser.id }, jwtSecret, { expiresIn: "7d" });
          return res.json({ 
            user: { ...existingUser, password: undefined },
            token,
            isExisting: true
          });
        } else {
          return res.status(400).json({ message: "این شماره قبلاً ثبت شده است. رمز عبور اشتباه است" });
        }
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const storeName = seller.storeName || `فروشگاه ${seller.firstName}`;
      
      const user = await storage.createUser({
        username: normalizedPhone,
        firstName: "مشتری",
        lastName: storeName,
        phone: normalizedPhone,
        whatsappNumber: normalizedPhone,
        password: hashedPassword,
        role: "user_level_2",
        parentUserId: seller.id,
      });
      
      try {
        const trialSubscription = (await storage.getAllSubscriptions()).find(sub => 
          sub.isDefault === true
        );
        
        if (trialSubscription) {
          await storage.createUserSubscription({
            userId: user.id,
            subscriptionId: trialSubscription.id,
            remainingDays: 7,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: "active",
            isTrialPeriod: true,
          });
        }
      } catch (trialError) {
        console.error("خطا در ایجاد اشتراک آزمایشی:", trialError);
      }
      
      try {
        const whatsappSettings = await storage.getWhatsappSettings();
        if (whatsappSettings?.notifications?.includes('new_user') && whatsappSettings.isEnabled && whatsappSettings.token) {
          if (seller.phone) {
            const message = `👤 مشتری جدید از ویترین\n\nشماره: ${normalizedPhone}\nفروشگاه: ${storeName}`;
            await whatsAppSender.sendMessage(seller.phone, message, seller.id);
          }
        }
      } catch (notificationError) {
        console.error("خطا در ارسال اعلان:", notificationError);
      }
      
      const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
      
      res.json({ 
        user: { ...user, password: undefined },
        token,
        isExisting: false
      });
    } catch (error) {
      console.error("Error in vitrin quick register:", error);
      res.status(500).json({ message: "خطا در ثبت‌نام" });
    }
  });

  // Upload receipt image for vitrin (card-to-card payment verification)
  app.post("/api/vitrin/:username/upload-receipt", uploadWhatsApp.single("receipt"), async (req, res) => {
    try {
      const { username } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: "لطفاً تصویر رسید را ارسال کنید" });
      }

      const seller = await storage.getUserByUsername(username);
      if (!seller || seller.role !== "user_level_1") {
        return res.status(404).json({ message: "فروشگاه یافت نشد" });
      }

      const imageUrl = `/UploadsPicClienet/${req.file.filename}`;
      const fullImageUrl = `${req.protocol}://${req.get('host')}${imageUrl}`;

      const { aiService } = await import("./ai-service");
      
      if (!aiService.isActive()) {
        return res.status(503).json({ 
          message: "سرویس پردازش تصویر در دسترس نیست. لطفاً بعداً تلاش کنید." 
        });
      }

      let depositInfo;
      try {
        depositInfo = await aiService.extractDepositInfoFromImage(fullImageUrl);
      } catch (aiError) {
        console.error("Error extracting deposit info:", aiError);
        return res.status(500).json({ 
          message: "خطا در پردازش تصویر رسید. لطفاً تصویر واضح‌تری ارسال کنید." 
        });
      }

      const missingFields = [];
      if (!depositInfo.amount) missingFields.push('مبلغ');
      if (!depositInfo.referenceId) missingFields.push('شماره پیگیری');
      
      if (missingFields.length > 0) {
        return res.json({ 
          message: `تصویر دریافت شد ولی اطلاعات کامل نیست. فیلدهای ناقص: ${missingFields.join('، ')}\n\nلطفاً تصویر واضح‌تری ارسال کنید یا اطلاعات را به صورت متن ارسال کنید.`,
          extracted: depositInfo
        });
      }

      if (depositInfo.referenceId) {
        const existingTransaction = await storage.getTransactionByReferenceId(depositInfo.referenceId);
        if (existingTransaction) {
          return res.json({ 
            message: "این رسید قبلاً ثبت شده است.",
            duplicate: true
          });
        }
      }

      const transaction = await storage.createTransaction({
        userId: seller.id,
        type: "deposit",
        amount: depositInfo.amount || "0",
        description: `واریز کارت به کارت از ویترین - ${depositInfo.referenceId || 'بدون شماره پیگیری'}`,
        referenceId: depositInfo.referenceId || null,
        status: "pending",
        paymentMethod: depositInfo.paymentMethod || "کارت به کارت",
        transactionDate: depositInfo.transactionDate || null,
        transactionTime: depositInfo.transactionTime || null,
        accountSource: depositInfo.accountSource || null,
        imageUrl: imageUrl
      });

      try {
        if (seller.whatsappNumber || seller.phone) {
          const formattedAmount = parseFloat(depositInfo.amount || "0").toLocaleString('fa-IR');
          const notificationMessage = `💰 واریز جدید از ویترین\n\n` +
            `مبلغ: ${formattedAmount} ریال\n` +
            `شماره پیگیری: ${depositInfo.referenceId || 'نامشخص'}\n` +
            `تاریخ: ${depositInfo.transactionDate || 'نامشخص'}\n\n` +
            `⏳ در انتظار تایید شما`;
          
          await whatsAppSender.sendMessage(
            seller.whatsappNumber || seller.phone,
            notificationMessage,
            seller.id
          );
        }
      } catch (notifyError) {
        console.error("Error sending notification:", notifyError);
      }

      res.json({ 
        message: "تصویر رسید دریافت و پردازش شد. ✅\n\nاطلاعات استخراج شده:\n" +
          `💰 مبلغ: ${parseFloat(depositInfo.amount || "0").toLocaleString('fa-IR')} ریال\n` +
          `📋 شماره پیگیری: ${depositInfo.referenceId || 'نامشخص'}\n` +
          `📅 تاریخ: ${depositInfo.transactionDate || 'نامشخص'}\n\n` +
          `در انتظار تایید فروشنده...`,
        success: true,
        transactionId: transaction.id
      });

    } catch (error) {
      console.error("Error processing receipt upload:", error);
      res.status(500).json({ message: "خطا در پردازش تصویر رسید" });
    }
  });

  // Get seller's vitrin settings (authenticated - level 1 only)
  app.get("/api/seller/vitrin", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "user_level_1") {
        return res.status(403).json({ message: "فقط فروشندگان به این بخش دسترسی دارند" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      res.json({
        username: user.username,
        storeName: user.storeName || `فروشگاه ${user.firstName}`,
        storeDescription: user.storeDescription || "",
        storeLogo: user.storeLogo || user.profilePicture,
        vitrinUrl: `/vitrin/${user.username}`,
      });
    } catch (error) {
      console.error("Error getting seller vitrin settings:", error);
      res.status(500).json({ message: "خطا در دریافت تنظیمات ویترین" });
    }
  });

  // Update seller's vitrin settings (authenticated - level 1 only)
  app.put("/api/seller/vitrin", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "user_level_1") {
        return res.status(403).json({ message: "فقط فروشندگان به این بخش دسترسی دارند" });
      }

      const { storeName, storeDescription } = req.body;

      await storage.updateUser(req.user.id, {
        storeName: storeName || null,
        storeDescription: storeDescription || null,
      });

      res.json({ message: "تنظیمات ویترین با موفقیت به‌روزرسانی شد" });
    } catch (error) {
      console.error("Error updating seller vitrin settings:", error);
      res.status(500).json({ message: "خطا در به‌روزرسانی تنظیمات ویترین" });
    }
  });

  // Upload store logo (authenticated - level 1 only)
  app.post("/api/seller/vitrin/logo", authenticateToken, upload.single("logo"), async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "user_level_1") {
        return res.status(403).json({ message: "فقط فروشندگان به این بخش دسترسی دارند" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "فایل تصویر الزامی است" });
      }

      const logoUrl = `/uploads/${req.file.filename}`;
      
      await storage.updateUser(req.user.id, {
        storeLogo: logoUrl,
      });

      res.json({ 
        message: "لوگوی فروشگاه با موفقیت آپلود شد",
        logoUrl 
      });
    } catch (error) {
      console.error("Error uploading store logo:", error);
      res.status(500).json({ message: "خطا در آپلود لوگو" });
    }
  });

  // =====================
  // EMAILS API ROUTES
  // =====================

  // Get all emails for admin (admin only)
  app.get("/api/admin/emails", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      const allEmails = await db
        .select()
        .from(emails)
        .where(eq(emails.userId, req.user.id))
        .orderBy(desc(emails.receivedAt));
      res.json(allEmails);
    } catch (error) {
      console.error("Error getting emails:", error);
      res.status(500).json({ message: "خطا در دریافت ایمیل‌ها" });
    }
  });

  // Mark email as read (admin only)
  app.patch("/api/admin/emails/:id/read", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      const email = await db
        .update(emails)
        .set({ isRead: true })
        .where(eq(emails.id, req.params.id))
        .returning();
      res.json(email[0]);
    } catch (error) {
      console.error("Error marking email as read:", error);
      res.status(500).json({ message: "خطا در علامت‌گذاری ایمیل" });
    }
  });

  // Delete email (admin only)
  app.delete("/api/admin/emails/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      await db
        .delete(emails)
        .where(eq(emails.id, req.params.id));
      res.json({ message: "ایمیل با موفقیت حذف شد" });
    } catch (error) {
      console.error("Error deleting email:", error);
      res.status(500).json({ message: "خطا در حذف ایمیل" });
    }
  });

  // =====================
  // PLUGINS API ROUTES
  // =====================

  // Get all plugins (admin only)
  app.get("/api/admin/plugins", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      const plugins = await storage.getAllPlugins();
      res.json(plugins);
    } catch (error) {
      console.error("Error getting plugins:", error);
      res.status(500).json({ message: "خطا در دریافت پلاگین‌ها" });
    }
  });

  // Create a new plugin (admin only)
  app.post("/api/admin/plugins", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      const { name, displayName, description, icon } = req.body;
      
      if (!name || !displayName) {
        return res.status(400).json({ message: "نام و نام نمایشی الزامی است" });
      }

      const existingPlugin = await storage.getPluginByName(name);
      if (existingPlugin) {
        return res.status(400).json({ message: "پلاگین با این نام قبلاً وجود دارد" });
      }

      const plugin = await storage.createPlugin({
        name,
        displayName,
        description: description || "",
        icon: icon || "Puzzle",
        isEnabled: true,
        isBuiltIn: false,
      });
      res.status(201).json(plugin);
    } catch (error) {
      console.error("Error creating plugin:", error);
      res.status(500).json({ message: "خطا در ایجاد پلاگین" });
    }
  });

  // Toggle plugin status (admin only)
  app.patch("/api/admin/plugins/:id/toggle", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      const plugin = await storage.togglePluginStatus(req.params.id);
      if (!plugin) {
        return res.status(404).json({ message: "پلاگین یافت نشد" });
      }
      res.json(plugin);
    } catch (error) {
      console.error("Error toggling plugin:", error);
      res.status(500).json({ message: "خطا در تغییر وضعیت پلاگین" });
    }
  });

  // Update plugin (admin only)
  app.put("/api/admin/plugins/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      const { displayName, description, icon } = req.body;
      const plugin = await storage.updatePlugin(req.params.id, {
        displayName,
        description,
        icon,
      });
      if (!plugin) {
        return res.status(404).json({ message: "پلاگین یافت نشد" });
      }
      res.json(plugin);
    } catch (error) {
      console.error("Error updating plugin:", error);
      res.status(500).json({ message: "خطا در به‌روزرسانی پلاگین" });
    }
  });

  // Delete plugin (admin only, non-builtin only)
  app.delete("/api/admin/plugins/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      const plugin = await storage.getPlugin(req.params.id);
      if (!plugin) {
        return res.status(404).json({ message: "پلاگین یافت نشد" });
      }
      if (plugin.isBuiltIn) {
        return res.status(400).json({ message: "پلاگین‌های پیش‌فرض قابل حذف نیستند" });
      }
      await storage.deletePlugin(req.params.id);
      res.json({ message: "پلاگین با موفقیت حذف شد" });
    } catch (error) {
      console.error("Error deleting plugin:", error);
      res.status(500).json({ message: "خطا در حذف پلاگین" });
    }
  });

  // Check if a specific plugin is enabled (for conditional menu items)
  app.get("/api/plugins/:name/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const plugin = await storage.getPluginByName(req.params.name);
      res.json({ isEnabled: plugin?.isEnabled ?? false });
    } catch (error) {
      console.error("Error checking plugin status:", error);
      res.status(500).json({ message: "خطا در بررسی وضعیت پلاگین" });
    }
  });

  // Public endpoint to check guest-chats plugin status (no auth required)
  app.get("/api/plugins/guest-chats/public-status", async (req, res) => {
    try {
      const plugin = await storage.getPluginByName("guest-chats");
      res.json({ isEnabled: plugin?.isEnabled ?? false });
    } catch (error) {
      console.error("Error checking guest-chats plugin status:", error);
      res.json({ isEnabled: false });
    }
  });

  // Email management endpoints
  app.get("/api/emails", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "کاربر تشخیص داده نشد" });
      }
      const emails = await db.query.receivedMessages.findMany({
        where: eq(receivedMessages.userId, req.user.id),
      });
      res.json(emails);
    } catch (error) {
      console.error("خطا در دریافت ایمیل‌ها:", error);
      res.status(500).json({ message: "خطا در دریافت ایمیل‌ها" });
    }
  });

  app.post("/api/emails/receive", async (req, res) => {
    try {
      const { userId, sender, subject, message } = req.body;
      
      if (!userId || !sender || !message) {
        return res.status(400).json({ message: "اطلاعات ناقص است" });
      }

      await db.insert(receivedMessages).values({
        userId,
        whatsiPlusId: `email_${Date.now()}_${Math.random()}`,
        sender,
        message: `موضوع: ${subject || 'بدون موضوع'}\n\n${message}`,
        status: "خوانده نشده",
        timestamp: new Date(),
      });

      console.log(`📧 ایمیل جدید دریافت شد از: ${sender}`);
      res.json({ message: "ایمیل با موفقیت دریافت شد" });
    } catch (error) {
      console.error("خطا:", error);
      res.status(500).json({ message: "خطا در ذخیره ایمیل" });
    }
  });

  // Sent messages history for current user
  app.get("/api/sent-messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) return res.status(401).json({ message: "کاربر تشخیص داده نشد" });
      const rows = await db.select().from(sentMessages).where(eq(sentMessages.userId, req.user.id)).orderBy(desc(sentMessages.timestamp));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching sent messages:", error);
      res.status(500).json({ message: "خطا در دریافت پیام‌های ارسالی" });
    }
  });

  // Send email (authenticated) - supports attachments (multipart/form-data)
  app.post("/api/emails/send", authenticateToken, emailUpload.array("attachments", 5), async (req: AuthRequest, res) => {
    try {
      // If multipart, multer populated req.files; otherwise body has JSON
      const files = (req as any).files as Express.Multer.File[] | undefined;
      const { to, subject, message, cc, bcc, scheduledAt } = req.body as any;
      if (!to || !message) return res.status(400).json({ message: "آدرس گیرنده و متن پیام لازم است" });

      const { sendMail } = await import("./email-sender");

      const attachments = (files || []).map(f => ({ filename: f.originalname, path: f.path }));

      const result = await sendMail(req.user!.id, to, subject || "(بدون موضوع)", message, attachments);

      if (!result.success) {
        return res.status(500).json({ message: "خطا در ارسال ایمیل", error: result.error });
      }

      res.json({ message: "ایمیل با موفقیت ارسال شد", info: result.info });
    } catch (error) {
      console.error("Error in /api/emails/send:", error);
      res.status(500).json({ message: "خطا در ارسال ایمیل" });
    }
  });

  app.put("/api/emails/:id/read", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const email = await db.query.receivedMessages.findFirst({
        where: eq(receivedMessages.id, id),
      });

      if (!email || email.userId !== req.user?.id) {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      await db.update(receivedMessages)
        .set({ status: "خوانده شده" })
        .where(eq(receivedMessages.id, id));

      res.json({ message: "ایمیل به عنوان خوانده شده علامت‌گذاری شد" });
    } catch (error) {
      console.error("خطا:", error);
      res.status(500).json({ message: "خطا در به‌روزرسانی وضعیت" });
    }
  });

  app.delete("/api/emails/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const email = await db.query.receivedMessages.findFirst({
        where: eq(receivedMessages.id, id),
      });

      if (!email || email.userId !== req.user?.id) {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }

      await db.delete(receivedMessages)
        .where(eq(receivedMessages.id, id));

      res.json({ message: "ایمیل حذف شد" });
    } catch (error) {
      console.error("خطا:", error);
      res.status(500).json({ message: "خطا در حذف ایمیل" });
    }
  });

  // Email settings endpoints
  app.get("/api/email-settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "کاربر تشخیص داده نشد" });
      }
      
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user.id),
      });

      if (!user) {
        return res.status(404).json({ message: "کاربر یافت نشد" });
      }

      // Extract email prefix from user's email if it exists
      const emailPrefix = user.email ? user.email.split('@')[0] : "";

      res.json({ emailPrefix });
    } catch (error) {
      console.error("خطا در دریافت تنظیمات ایمیل:", error);
      res.status(500).json({ message: "خطا در دریافت تنظیمات ایمیل" });
    }
  });

  app.post("/api/email-settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "کاربر تشخیص داده نشد" });
      }

      const { emailPrefix } = req.body;

      if (!emailPrefix || typeof emailPrefix !== "string") {
        return res.status(400).json({ message: "پیشوند ایمیل نامعتبر است" });
      }

      // Get domain from environment or use default
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.DOMAIN || "localhost";
      const newEmail = `${emailPrefix}@${domain}`;

      await db.update(users)
        .set({ email: newEmail })
        .where(eq(users.id, req.user.id));

      res.json({ emailPrefix, message: "تنظیمات ایمیل با موفقیت ذخیره شد" });
    } catch (error) {
      console.error("خطا در ذخیره تنظیمات ایمیل:", error);
      res.status(500).json({ message: "خطا در ذخیره تنظیمات ایمیل" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Email management endpoints

