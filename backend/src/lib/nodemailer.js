import nodemailer from "nodemailer";
import { ENV } from "./env.js";

export const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  service: ENV.SMTP_SERVICE,
  port: ENV.SMTP_PORT,
  secure: ENV.SMTP_PORT == 465, // true for 465, false for 587/25
  auth: {
    user: ENV.SMTP_MAIL,
    pass: ENV.SMTP_PASSWORD,
  },
  pool: true,
});

export const sender = {
  email: ENV.EMAIL_FROM,
  name: ENV.EMAIL_FROM_NAME,
};