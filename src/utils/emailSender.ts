import nodemailer, { Transporter } from "nodemailer";
import fs from "fs";
import ejs from "ejs";
import path from "path";
import { APP_CONSTANTS } from "./constants";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from?: string;
}

export type SendEmailResult =
  | { success: true; messageId: string }
  | { success: false; error: string; details?: any };

export class EmailSender {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USERNAME;
    const pass = process.env.SMTP_PASSWORD;

    if (!host || !user || !pass) {
      console.error(
        "Missing required SMTP configuration. Please check your environment variables: SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD"
      );
      this.transporter = nodemailer.createTransport({} as any);
      this.config = {} as EmailConfig;
      return;
    }

    this.config = {
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
      from: process.env.SMTP_FROMADDRESS,
    };

    this.transporter = nodemailer.createTransport(this.config);
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async sendEmail(to: string, subject: string, text: string): Promise<SendEmailResult> {
    try {
      if (!to || !subject || !text) {
        return {
          success: false,
          error: APP_CONSTANTS.message.missing_email_params,
        };
      }

      if (!this.validateEmail(to)) {
        return {
          success: false,
          error: `${APP_CONSTANTS.message.invalid_recipient_email}: ${to}`,
        };
      }

      const mailOptions = {
        from: this.config.from ?? `"App" <${this.config.auth.user}>`,
        to,
        subject,
        text,
      };

      try {
        await this.transporter.verify();
      } catch (verifyError: any) {
        return {
          success: false,
          error: APP_CONSTANTS.message.smtp_verification_failed,
          details: {
            message: verifyError.message,
            code: verifyError.code,
          },
        };
      }

      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error(`${APP_CONSTANTS.message.failed_send_email} to ${to}:`, {
        error: error.message,
        stack: error.stack,
        code: error.code,
        command: error.command,
      });
      return {
        success: false,
        error: APP_CONSTANTS.message.failed_send_email,
        details: {
          message: error.message,
          code: error.code,
          command: error.command,
        },
      };
    }
  }

  async sendTemplate(
    to: string,
    subject: string,
    templatePath: string,
    data: Record<string, any>
  ): Promise<SendEmailResult> {
    try {
      if (!to || !subject || !templatePath) {
        return {
          success: false,
          error: APP_CONSTANTS.message.missing_template_params,
        };
      }

      if (!this.validateEmail(to)) {
        return {
          success: false,
          error: `${APP_CONSTANTS.message.invalid_recipient_email}: ${to}`,
        };
      }

      if (!fs.existsSync(templatePath)) {
        return {
          success: false,
          error: `${APP_CONSTANTS.message.template_file_not_found}: ${templatePath}`,
        };
      }

      let html: string;
      try {
        const template = fs.readFileSync(templatePath, "utf-8");
        html = ejs.render(template, { ...data, baseUrl: process.env.BASE_URL });
      } catch (err) {
        return {
          success: false,
          error: APP_CONSTANTS.message.failed_render_template,
          details: err instanceof Error ? err.message : String(err),
        };
      }

      try {
        await this.transporter.verify();
      } catch (verifyError: any) {
        return {
          success: false,
          error: APP_CONSTANTS.message.smtp_verification_failed,
          details: {
            message: verifyError.message,
            code: verifyError.code,
          },
        };
      }

      const info = await this.transporter.sendMail({
        from: this.config.from ?? `"App" <${this.config.auth.user}>`,
        to,
        subject,
        html,
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error(`${APP_CONSTANTS.message.failed_send_template_email} to ${to}:`, {
        error: error.message,
        stack: error.stack,
        templatePath,
        code: error.code,
        command: error.command,
      });
      return {
        success: false,
        error: APP_CONSTANTS.message.failed_send_template_email,
        details: {
          message: error.message,
          code: error.code,
          command: error.command,
          templatePath,
        },
      };
    }
  }

  templatePath(fileName: string): string {
    const base = process.env.MAIN_PATH || "src";
    return path.join(process.cwd(), base, "util/templates", fileName);
  }
}