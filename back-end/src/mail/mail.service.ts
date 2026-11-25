import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendMailResult {
  success: boolean;
  mode: 'smtp' | 'ethereal' | 'console';
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

export interface PasswordResetEmailOptions {
  to: string;
  name?: string;
  resetLink: string;
  expiryMinutes?: number;
}

export interface EmailVerificationEmailOptions {
  to: string;
  name?: string;
  verificationLink: string;
  expiryHours?: number;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private mode: 'smtp' | 'ethereal' | 'console' = 'console';
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress = 'TeamForge <no-reply@teamforge.io>';
  private isReady = false;
  private lastError: { message: string; timestamp: Date } | null = null;
  private lastSentAt: Date | null = null;

  async onModuleInit() {
    await this.initializeTransport();
  }

  async initializeTransport(): Promise<void> {
    const rawMode = (process.env.MAIL_MODE || '').toLowerCase().trim();
    const isProd = process.env.NODE_ENV === 'production';

    if (!rawMode) {
      if (isProd) {
        const errMsg = 'MAIL_MODE must be configured in production (smtp, ethereal, console)';
        this.logger.error(errMsg);
        throw new Error(errMsg);
      }
      this.mode = 'ethereal';
      this.logger.log('MAIL_MODE not specified; defaulting to "ethereal" in development.');
    } else if (rawMode === 'smtp' || rawMode === 'ethereal' || rawMode === 'console') {
      this.mode = rawMode;
    } else {
      this.logger.warn(`Unknown MAIL_MODE "${rawMode}"; falling back to "ethereal".`);
      this.mode = 'ethereal';
    }

    const rawFrom = (process.env.MAIL_FROM || 'TeamForge <no-reply@teamforge.io>').replace(/^["']|["']$/g, '').trim();
    this.fromAddress = rawFrom;

    try {
      if (this.mode === 'smtp') {
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = Number(process.env.SMTP_PORT) || 465;
        const secure = process.env.SMTP_SECURE === 'true' || port === 465;
        const user = process.env.SMTP_USER || '';
        const pass = process.env.SMTP_PASS || '';

        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user ? { user, pass } : undefined,
        });

        try {
          await this.transporter.verify();
          this.isReady = true;
          this.logger.log(`mail transport ready (SMTP host: ${host}:${port}, secure: ${secure})`);
        } catch (verifyErr: any) {
          this.isReady = false;
          this.lastError = { message: verifyErr?.message || 'SMTP verification failed', timestamp: new Date() };
          this.logger.error(`Mail transport verification failed: ${verifyErr?.message}`);
        }
      } else if (this.mode === 'ethereal') {
        try {
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
          // For Ethereal test inbox, format from header with the verified test account user
          this.fromAddress = `"TeamForge" <${testAccount.user}>`;
          this.isReady = true;
          this.logger.log(`Mail transport ready (Ethereal test account: ${testAccount.user})`);
        } catch (testAccountErr: any) {
          this.isReady = false;
          this.lastError = { message: testAccountErr?.message || 'Ethereal init failed', timestamp: new Date() };
          this.logger.error(`Failed to create Ethereal test account: ${testAccountErr?.message}. Falling back to console.`);
          this.mode = 'console';
        }
      } else {
        // console mode
        this.transporter = null;
        this.isReady = true;
        this.logger.log('Mail transport ready (Console DEV ONLY mode)');
      }
    } catch (err: any) {
      this.isReady = false;
      this.lastError = { message: err?.message || 'Mail transport init failed', timestamp: new Date() };
      this.logger.error(`Mail service init error: ${err?.message}`);
    }
  }

  getMode(): 'smtp' | 'ethereal' | 'console' {
    return this.mode;
  }

  getHealth() {
    return {
      status: this.isReady ? 'ready' : (this.lastError ? 'error' : 'uninitialized'),
      mode: this.mode,
      configured: true,
      from: this.fromAddress,
      lastError: this.lastError ? this.lastError.message : null,
      lastSentAt: this.lastSentAt ? this.lastSentAt.toISOString() : null,
    };
  }

  private buildBrandedActionHtml(params: {
    title: string;
    heading: string;
    recipientName: string;
    introText: string;
    ctaLabel: string;
    actionLink: string;
    calloutText: string;
    footerNote: string;
  }): string {
    const { title, heading, recipientName, introText, ctaLabel, actionLink, calloutText, footerNote } = params;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 12px;">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0" border="0">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="display: inline-block; width: 36px; height: 36px; line-height: 36px; text-align: center; background: #2563eb; color: #ffffff; font-weight: 800; font-size: 16px; border-radius: 8px;">TF</div>
                    <span style="font-size: 20px; font-weight: 700; color: #ffffff; margin-left: 12px; vertical-align: middle; letter-spacing: -0.5px;">TeamForge</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;">${heading}</h1>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>${recipientName}</strong>,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">${introText}</p>

              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #2563eb;">
                    <a href="${actionLink}" target="_blank" style="font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.5; color: #64748b;">Or copy and paste this link into your browser:</p>
              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.5; color: #2563eb; word-break: break-all;">
                <a href="${actionLink}" target="_blank" style="color: #2563eb; text-decoration: underline;">${actionLink}</a>
              </p>

              <!-- Expiry Callout -->
              <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 12px 16px; margin: 0 0 24px 0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #334155;">${calloutText}</p>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">${footerNote}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} TeamForge. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private async dispatchTransporterWithRetry(params: {
    to: string;
    subject: string;
    plainText: string;
    htmlContent: string;
    actionLink: string;
    logLabel: string;
  }): Promise<SendMailResult> {
    const { to, subject, plainText, htmlContent, actionLink, logLabel } = params;

    if (this.mode === 'console' || !this.transporter) {
      this.lastSentAt = new Date();
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`[CONSOLE MAIL] To: ${to}`);
      console.log(`[CONSOLE MAIL] Subject: ${subject}`);
      console.log(`[CONSOLE MAIL] Link: ${actionLink}`);
      console.log('─────────────────────────────────────────────────────────────');
      return {
        success: true,
        mode: 'console',
        messageId: `console-${Date.now()}`,
        previewUrl: false,
      };
    }

    let info: any = null;
    let lastSendErr: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        info = await this.transporter.sendMail({
          from: this.fromAddress,
          to,
          subject,
          text: plainText,
          html: htmlContent,
        });
        lastSendErr = null;
        break;
      } catch (err: any) {
        lastSendErr = err;
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
    }

    if (lastSendErr || !info) {
      this.lastError = { message: lastSendErr?.message || 'Failed to send mail', timestamp: new Date() };
      this.logger.error(`Failed to send ${logLabel} email to ${to}: ${lastSendErr?.message}`);
      return {
        success: false,
        mode: this.mode,
        error: lastSendErr?.message || 'Mail dispatch error',
      };
    }

    this.lastSentAt = new Date();

    if (this.mode === 'ethereal') {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`[ETHEREAL MAIL] Test inbox, not a real email.`);
      console.log(`[ETHEREAL MAIL] To: ${to}`);
      console.log(`[ETHEREAL MAIL] Preview URL: ${previewUrl}`);
      console.log('─────────────────────────────────────────────────────────────');
      return {
        success: true,
        mode: 'ethereal',
        messageId: info.messageId,
        previewUrl: previewUrl || false,
      };
    }

    this.logger.log(`${logLabel} email delivered via SMTP to ${to} (MessageId: ${info.messageId})`);
    return {
      success: true,
      mode: 'smtp',
      messageId: info.messageId,
      previewUrl: false,
    };
  }

  async sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<SendMailResult> {
    const { to, name, resetLink, expiryMinutes = 15 } = options;
    const recipientName = name ? name.trim() : 'there';
    const subject = 'Reset your TeamForge password';

    const plainText = `Reset your TeamForge password

Hello ${recipientName},

We received a request to reset your password for your TeamForge account.

To reset your password, visit the link below:
${resetLink}

This password reset link will expire in ${expiryMinutes} minutes.

If you did not request a password reset, please ignore this email. Your account remains secure.

--
TeamForge Platform Team
`;

    const htmlContent = this.buildBrandedActionHtml({
      title: 'Reset your TeamForge password',
      heading: 'Password Reset Request',
      recipientName,
      introText: 'We received a request to reset your password for your TeamForge account. Click the button below to choose a new password:',
      ctaLabel: 'Reset Password',
      actionLink: resetLink,
      calloutText: `⏱ <strong>Note:</strong> This link will expire in <strong>${expiryMinutes} minutes</strong> and can only be used once.`,
      footerNote: 'If you did not request a password reset, you can safely ignore this email. Your password will not be changed without this link.',
    });

    return this.dispatchTransporterWithRetry({
      to,
      subject,
      plainText,
      htmlContent,
      actionLink: resetLink,
      logLabel: 'Password reset',
    });
  }

  async sendEmailVerificationEmail(options: EmailVerificationEmailOptions): Promise<SendMailResult> {
    const { to, name, verificationLink, expiryHours = 24 } = options;
    const recipientName = name ? name.trim() : 'there';
    const subject = 'Verify your TeamForge email address';

    const plainText = `Verify your TeamForge email address

Hello ${recipientName},

Thanks for joining TeamForge! Please verify your email address to unlock project creation, team applications, chat, and mentor sessions.

Click or copy the link below:
${verificationLink}

This verification link will expire in ${expiryHours} hours and can only be used once.

If you did not sign up for TeamForge, you can safely ignore this email.

--
TeamForge Platform Team
`;

    const htmlContent = this.buildBrandedActionHtml({
      title: 'Verify your TeamForge email address',
      heading: 'Verify Your Email Address',
      recipientName,
      introText: 'Thanks for joining TeamForge! Click the button below to confirm your email address and unlock creating projects, applying to teams, messaging, and booking mentors:',
      ctaLabel: 'Verify Email Address',
      actionLink: verificationLink,
      calloutText: `⏱ <strong>Note:</strong> This link expires in <strong>${expiryHours} hours</strong> and can only be used once.`,
      footerNote: 'If you did not create a TeamForge account, you can safely ignore this message.',
    });

    return this.dispatchTransporterWithRetry({
      to,
      subject,
      plainText,
      htmlContent,
      actionLink: verificationLink,
      logLabel: 'Email verification',
    });
  }

  async sendMail(options: { to: string; subject: string; text: string; html?: string }): Promise<SendMailResult> {
    const { to, subject, text, html } = options;

    if (this.mode === 'console') {
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`[CONSOLE MAIL] Simulated email dispatch`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${text}`);
      console.log('─────────────────────────────────────────────────────────────');
      this.lastSentAt = new Date();
      return { success: true, mode: 'console', messageId: `console-${Date.now()}` };
    }

    if (!this.transporter) {
      await this.initializeTransport();
    }

    if (!this.transporter) {
      this.logger.warn(`Mail transporter unavailable; falling back to console dispatch for ${to}`);
      console.log(`[CONSOLE FALLBACK] To: ${to} | Subject: ${subject}\n${text}`);
      return { success: true, mode: 'console', messageId: `fallback-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text,
        html: html || `<p style="font-family: sans-serif; white-space: pre-wrap;">${text}</p>`,
      });
      this.lastSentAt = new Date();
      let previewUrl: string | false = false;
      if (this.mode === 'ethereal') {
        previewUrl = nodemailer.getTestMessageUrl(info) || false;
      }
      return { success: true, mode: this.mode, messageId: info.messageId, previewUrl };
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch email to ${to}: ${err?.message || err}`);
      return { success: false, mode: this.mode, error: err?.message || 'Mail dispatch error' };
    }
  }

  async sendWarningEmail(options: {
    to: string;
    name?: string;
    warningNumber: number;
    maxWarnings?: number;
    reason: string;
  }): Promise<SendMailResult> {
    const { to, name, warningNumber, maxWarnings = 4, reason } = options;
    const recipientName = name || 'User';
    const subject = `[TeamForge] Official Account Warning (${warningNumber}/${maxWarnings})`;
    const text = `Hello ${recipientName},

You have received an official account warning (${warningNumber}/${maxWarnings}) on TeamForge.

Reason for warning:
${reason}

Please note: An account with ${maxWarnings} active warnings is suspended automatically.
Each active warning temporarily reduces your reputation score by 10 points. You may submit an appeal within 7 days.

Best regards,
The TeamForge Moderation Team`;

    return this.sendMail({ to, subject, text });
  }

  async sendSuspensionEmail(options: {
    to: string;
    name?: string;
    reason: string;
  }): Promise<SendMailResult> {
    const { to, name, reason } = options;
    const recipientName = name || 'User';
    const subject = `[TeamForge] Account Suspended`;
    const text = `Hello ${recipientName},

Your TeamForge account has been suspended.

Reason:
${reason}

While suspended, you cannot access your account or participate in projects.
If you believe this was in error, please contact platform support.

Best regards,
The TeamForge Moderation Team`;

    return this.sendMail({ to, subject, text });
  }

  async sendAccountDeletionCodeEmail(options: {
    to: string;
    name?: string;
    code: string;
    expiresInMinutes?: number;
  }): Promise<SendMailResult> {
    const { to, name, code, expiresInMinutes = 10 } = options;
    const recipientName = name || 'there';
    const subject = '[TeamForge] Account Deletion Verification Code';
    const plainText = `Hello ${recipientName},

You requested to permanently delete your TeamForge account.

Your 6-digit verification code is: ${code}

This code expires in ${expiresInMinutes} minutes and can only be used once. If you did not request this, you can safely ignore this email — your account will remain active.

Best regards,
TeamForge Security`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; background-color: #f8fafc; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 28px;">
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px;">Account Deletion Verification</h2>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569;">Hello ${recipientName},</p>
    <p style="margin: 0 0 18px 0; font-size: 14px; color: #334155;">Enter the single-use verification code below to confirm permanent deletion of your TeamForge account:</p>
    <div style="margin: 0 0 20px 0; padding: 14px 20px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #991b1b;">${code}</div>
    <p style="margin: 0; font-size: 13px; color: #64748b;">This code expires in ${expiresInMinutes} minutes and allows at most 5 verification attempts.</p>
  </div>
</body>
</html>`;

    return this.sendMail({
      to,
      subject,
      text: plainText,
      html: htmlContent,
    });
  }
}
