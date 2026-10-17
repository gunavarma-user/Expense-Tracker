import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { db, queryOne, execute } from './db.ts';

// 5 minutes in milliseconds
export const OTP_EXPIRY_MS = 5 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 3;
// 60-second cooldown between OTP requests for the same contact
export const OTP_COOLDOWN_MS = 60 * 1000;
// Maximum 5 OTP requests per hour per contact
export const OTP_HOURLY_LIMIT = 5;
// Sessions valid for 30 days
export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionData {
  token: string;
  user_id: string;
  savings_unlocked: boolean;
  expires_at: number;
}

export type OtpPurpose = 'verify_email' | 'verify_phone' | 'forgot_password' | 'registration_verify';

/**
 * Mask sensitive contact info for safe security logging.
 * Never outputs full email or mobile number to server logs.
 */
export function maskContact(contact: string): string {
  if (!contact) return '***';
  const trimmed = contact.trim();
  if (trimmed.includes('@')) {
    const [name, domain] = trimmed.split('@');
    if (name.length <= 2) return `**@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (trimmed.length <= 4) return '****';
  return `***${trimmed.slice(-4)}`;
}

/**
 * Hash password using Node's cryptographic scrypt algorithm with unique salt.
 * OWASP recommended memory-hard hashing. Format: salt:hashHex
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Validates email format using standard RFC 5322 regex.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Normalizes mobile numbers by removing whitespace, hyphens, parentheses, and dots.
 * If formatted with domestic leading zero (e.g. 09876543210), strips the trunk zero.
 */
export function normalizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[\s\-().]/g, '').trim();
  // Strip domestic leading 0 if 11 digits total (e.g. 09876543210 -> 9876543210)
  if (/^0[1-9]\d{9}$/.test(cleaned)) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Validates mobile number format.
 * Supports international E.164 (+ followed by 8-15 digits) or standard 10-15 digit mobile numbers.
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const normalized = normalizePhone(phone);
  const phoneRegex = /^(\+[1-9]\d{7,14}|[1-9]\d{9,14})$/;
  return phoneRegex.test(normalized);
}

/**
 * Persistent SQLite-backed rate limiter.
 * Survives process restarts and works reliably across multi-instance deployments.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const row = queryOne<{ attempts: number; last_attempt: number }>(
    `SELECT attempts, last_attempt FROM rate_limits WHERE key = ?`,
    key
  );

  if (!row) {
    execute(
      `INSERT INTO rate_limits (key, attempts, last_attempt) VALUES (?, 1, ?)`,
      key,
      now
    );
    return { allowed: true };
  }

  // If outside time window, reset counter
  if (now - row.last_attempt > windowMs) {
    execute(
      `UPDATE rate_limits SET attempts = 1, last_attempt = ? WHERE key = ?`,
      now,
      key
    );
    return { allowed: true };
  }

  // Inside time window: check if exceeded
  if (row.attempts >= maxAttempts) {
    const retryAfter = Math.ceil((windowMs - (now - row.last_attempt)) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  // Increment attempt counter
  execute(
    `UPDATE rate_limits SET attempts = attempts + 1, last_attempt = ? WHERE key = ?`,
    now,
    key
  );
  return { allowed: true };
}

/**
 * Persistent SQLite-backed cooldown tracker (e.g. 60 seconds between OTP dispatches).
 */
export function checkCooldown(
  key: string,
  cooldownMs: number
): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const row = queryOne<{ attempts: number; last_attempt: number }>(
    `SELECT last_attempt FROM rate_limits WHERE key = ?`,
    key
  );

  if (!row) {
    execute(`INSERT INTO rate_limits (key, attempts, last_attempt) VALUES (?, 1, ?)`, key, now);
    return { allowed: true };
  }

  const elapsed = now - row.last_attempt;
  if (elapsed < cooldownMs) {
    const waitSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
    return { allowed: false, waitSeconds: Math.max(1, waitSeconds) };
  }

  execute(`UPDATE rate_limits SET last_attempt = ? WHERE key = ?`, now, key);
  return { allowed: true };
}

export function resetRateLimit(key: string): void {
  execute(`DELETE FROM rate_limits WHERE key = ?`, key);
}

/**
 * Session Management
 */
export function createSession(userId: string): { token: string; expires_at: number } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_EXPIRY_MS;
  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, savings_unlocked, created_at, expires_at)
    VALUES (?, ?, 0, ?, ?)
  `);
  stmt.run(token, userId, createdAt, expiresAt);

  return { token, expires_at: expiresAt };
}

export function getSession(token: string): SessionData | null {
  if (!token) return null;
  const stmt = db.prepare(`
    SELECT token, user_id, savings_unlocked, expires_at
    FROM sessions
    WHERE token = ?
  `);
  const row = stmt.get(token) as { token: string; user_id: string; savings_unlocked: number; expires_at: number } | undefined;
  
  if (!row) return null;

  if (Date.now() > row.expires_at) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }

  return {
    token: row.token,
    user_id: row.user_id,
    savings_unlocked: Boolean(row.savings_unlocked),
    expires_at: row.expires_at
  };
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function setSavingsUnlocked(token: string, unlocked: boolean): void {
  db.prepare(`UPDATE sessions SET savings_unlocked = ? WHERE token = ?`).run(unlocked ? 1 : 0, token);
}

/**
 * Real SMS Delivery via Twilio REST API.
 * Uses Node 22 native fetch without external dependencies.
 */
export async function sendTwilioSms(
  toPhone: string,
  messageBody: string
): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromPhone = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || !fromPhone) {
    return {
      success: false,
      error: 'SMS service is not configured. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must be configured in .env.'
    };
  }

  // Ensure E.164 format with '+' prefix
  let formattedTo = toPhone.trim();
  if (!formattedTo.startsWith('+')) {
    formattedTo = '+' + formattedTo;
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.append('To', formattedTo);
  params.append('From', fromPhone);
  params.append('Body', messageBody);

  try {
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await res.json() as any;
    if (!res.ok) {
      const errMsg = data.message || `Twilio SMS delivery failed with HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: `Failed to contact Twilio SMS gateway: ${err.message}` };
  }
}

/**
 * Send email via SMTP using Node native sockets (net / tls).
 * Supports both Port 587 (STARTTLS) and Port 465 (SMTPS direct TLS).
 */
export async function sendSmtpEmail(
  toEmail: string,
  subject: string,
  bodyText: string
): Promise<{ success: boolean; error?: string }> {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user || 'noreply@expenseanalyzer.local';

  if (!host || !user || !pass) {
    return {
      success: false,
      error: 'Email service is not configured. SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) must be configured in .env.'
    };
  }

  return new Promise((resolve) => {
    const isDirectTls = port === 465;
    let socket: net.Socket | tls.TLSSocket;
    let buffer = '';
    let currentStep = 0;
    let isResolved = false;

    const timer = setTimeout(() => {
      finish(false, 'SMTP connection timed out after 15 seconds.');
    }, 15000);

    function finish(success: boolean, error?: string) {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timer);
      try {
        if (socket && !socket.destroyed) {
          socket.write('QUIT\r\n');
          socket.end();
        }
      } catch {}
      resolve({ success, error });
    }

    function send(cmd: string) {
      socket.write(cmd + '\r\n');
    }

    function processSmtpLine(code: number, line: string) {
      if (code >= 400) {
        finish(false, `SMTP server rejected command: [${code}] ${line}`);
        return;
      }

      switch (currentStep) {
        case 0: // Banner received -> send EHLO
          currentStep = 1;
          send(`EHLO ${host}`);
          break;
        case 1: // EHLO response received
          if (port === 587) {
            currentStep = 2;
            send('STARTTLS');
          } else {
            currentStep = 4;
            send('AUTH LOGIN');
          }
          break;
        case 2: // STARTTLS 220 received -> upgrade to TLS
          currentStep = 3;
          try {
            const tlsSocket = tls.connect({
              socket: socket as net.Socket,
              host,
              servername: host,
              rejectUnauthorized: process.env.NODE_ENV === 'production'
            });
            attachListeners(tlsSocket);
            socket = tlsSocket;
            send(`EHLO ${host}`);
          } catch (err: any) {
            finish(false, `STARTTLS handshake failed: ${err.message}`);
          }
          break;
        case 3: // 2nd EHLO after TLS -> send AUTH LOGIN
          currentStep = 4;
          send('AUTH LOGIN');
          break;
        case 4: // AUTH LOGIN 334 -> send base64 username
          currentStep = 5;
          send(Buffer.from(user!).toString('base64'));
          break;
        case 5: // 334 -> send base64 password
          currentStep = 6;
          send(Buffer.from(pass!).toString('base64'));
          break;
        case 6: // 235 Authentication successful -> send MAIL FROM
          currentStep = 7;
          // Extract plain email from From header if formatted as "Name <email>"
          const mailFrom = from.includes('<') ? from.split('<')[1].replace('>', '').trim() : from.trim();
          send(`MAIL FROM:<${mailFrom}>`);
          break;
        case 7: // 250 Sender OK -> send RCPT TO
          currentStep = 8;
          send(`RCPT TO:<${toEmail.trim()}>`);
          break;
        case 8: // 250 Recipient OK -> send DATA
          currentStep = 9;
          send('DATA');
          break;
        case 9: // 354 Enter mail -> send message body
          currentStep = 10;
          const dateStr = new Date().toUTCString();
          const msgId = `<${Date.now()}.${crypto.randomBytes(8).toString('hex')}@${host}>`;
          const rawMessage = [
            `From: ${from}`,
            `To: ${toEmail.trim()}`,
            `Subject: ${subject}`,
            `Date: ${dateStr}`,
            `Message-ID: ${msgId}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=utf-8',
            'Content-Transfer-Encoding: 7bit',
            '',
            bodyText,
            '',
            '.'
          ].join('\r\n');
          send(rawMessage);
          break;
        case 10: // 250 Message accepted
          finish(true);
          break;
      }
    }

    function attachListeners(s: net.Socket | tls.TLSSocket) {
      s.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\r\n');
        // Only keep unfinished line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          // Match standard SMTP final reply format: "250 OK" (not "250-SIZE")
          const match = line.match(/^(\d{3})\s+(.*)$/);
          if (match) {
            const code = parseInt(match[1], 10);
            processSmtpLine(code, match[2]);
          }
        }
      });

      s.on('error', (err) => {
        finish(false, `SMTP socket error: ${err.message}`);
      });
    }

    try {
      if (isDirectTls) {
        socket = tls.connect({
          host,
          port,
          servername: host,
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        });
      } else {
        socket = net.createConnection({ host, port });
      }
      attachListeners(socket);
    } catch (err: any) {
      finish(false, `Failed to initialize SMTP connection: ${err.message}`);
    }
  });
}

/**
 * Dispatch verification email through configured SMTP or transactional email API (Resend / SendGrid).
 */
export async function sendEmailOtp(
  toEmail: string,
  otpCode: string
): Promise<{ success: boolean; error?: string }> {
  const subject = 'Your Expense Analyzer Verification Code';
  const bodyText = `Hello,

Your 6-digit verification code for Personal Expense Pattern Analyzer is:

  ${otpCode}

This code will expire in 5 minutes.
If you did not request this verification code, please ignore this email.

Best regards,
Expense Pattern Analyzer Team`;

  // 1. Check if Resend API key is configured
  if (process.env.RESEND_API_KEY) {
    try {
      const from = process.env.SMTP_FROM || 'Expense Analyzer <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [toEmail.trim()],
          subject,
          text: bodyText
        })
      });
      if (res.ok) return { success: true };
      const data = await res.json() as any;
      return { success: false, error: data.message || `Resend delivery failed with HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: `Resend API error: ${err.message}` };
    }
  }

  // 2. Check if SendGrid API key is configured
  if (process.env.SENDGRID_API_KEY) {
    try {
      const from = process.env.SMTP_FROM || 'noreply@expenseanalyzer.local';
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toEmail.trim() }] }],
          from: { email: from },
          subject,
          content: [{ type: 'text/plain', value: bodyText }]
        })
      });
      if (res.status >= 200 && res.status < 300) return { success: true };
      return { success: false, error: `SendGrid delivery failed with HTTP status ${res.status}` };
    } catch (err: any) {
      return { success: false, error: `SendGrid API error: ${err.message}` };
    }
  }

  // 3. Check if SMTP credentials are configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendSmtpEmail(toEmail, subject, bodyText);
  }

  // No provider configured
  return {
    success: false,
    error: 'Email delivery provider is not configured. Please configure SMTP in .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) or set RESEND_API_KEY.'
  };
}

/**
 * Generates and sends a 6-digit OTP with 5-minute expiry, cooldown, and attempt limits.
 * Uses persistent rate limits and delivers real SMS or Email.
 * Never leaks plaintext OTP or credentials in responses or logs.
 */
export async function createAndSendOtp(
  target: string,
  purpose: OtpPurpose,
  options?: { skipRateLimit?: boolean; isTest?: boolean }
): Promise<{ success: boolean; message: string; error?: string }> {
  const isEmail = target.includes('@');
  const normalizedTarget = isEmail ? target.trim().toLowerCase() : normalizePhone(target);

  if (!normalizedTarget) {
    return { success: false, message: '', error: 'A valid email or mobile number is required.' };
  }

  // Check rate limits and cooldown unless explicitly skipped or running in automated test suite
  const isTestMode = options?.isTest === true;
  if (!options?.skipRateLimit && !isTestMode) {
    // 60-second cooldown per target
    const cooldown = checkCooldown(`cooldown:otp:${normalizedTarget}`, OTP_COOLDOWN_MS);
    if (!cooldown.allowed) {
      return {
        success: false,
        message: '',
        error: `Please wait ${cooldown.waitSeconds} second(s) before requesting another verification code.`
      };
    }

    // Hourly limit per target
    const hourlyLimit = checkRateLimit(`limit:otp:${normalizedTarget}`, OTP_HOURLY_LIMIT, 60 * 60 * 1000);
    if (!hourlyLimit.allowed) {
      return {
        success: false,
        message: '',
        error: `Too many verification requests. Please try again after ${Math.ceil((hourlyLimit.retryAfterSeconds || 60) / 60)} minute(s).`
      };
    }
  }

  const now = Date.now();
  const expiresAt = now + OTP_EXPIRY_MS;
  const otpId = crypto.randomUUID();

  // Cryptographically random 6-digit numeric OTP
  const codeInt = crypto.randomInt(100000, 999999);
  const otpCode = codeInt.toString();

  // Invalidate any prior active OTPs for the same target and purpose
  db.prepare(`
    DELETE FROM otps 
    WHERE target = ? AND purpose = ?
  `).run(normalizedTarget, purpose);

  // Insert new OTP record with 3 attempts left and 5-minute expiry
  db.prepare(`
    INSERT INTO otps (id, target, purpose, otp_code, attempts_left, expires_at, created_at, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(otpId, normalizedTarget, purpose, otpCode, MAX_OTP_ATTEMPTS, expiresAt, new Date().toISOString());

  // In automated test context: return immediately without sending real network requests
  if (isTestMode) {
    return {
      success: true,
      message: `Test verification code dispatched for ${maskContact(normalizedTarget)}.`
    };
  }

  // Attempt real delivery through the appropriate configured provider
  let deliveryResult: { success: boolean; error?: string };

  if (isEmail) {
    deliveryResult = await sendEmailOtp(normalizedTarget, otpCode);
  } else {
    const smsMessage = `Your Expense Analyzer verification code is: ${otpCode}. Valid for 5 minutes. Do not share this code.`;
    deliveryResult = await sendTwilioSms(normalizedTarget, smsMessage);
  }

  // If external delivery failed, rollback the OTP record and return clear error
  if (!deliveryResult.success) {
    db.prepare(`DELETE FROM otps WHERE id = ?`).run(otpId);
    return {
      success: false,
      message: '',
      error: deliveryResult.error || 'Failed to dispatch verification code.'
    };
  }

  // Safe logging: Never log the OTP code or secret credentials
  console.log(`[AUTH] Verification OTP successfully dispatched for ${purpose} to ${maskContact(normalizedTarget)}`);

  return {
    success: true,
    message: `A 5-minute verification code was sent to ${maskContact(normalizedTarget)}.`
  };
}

/**
 * Validates an OTP code.
 * Decrements attempts_left on failure.
 * Invalidates when attempts reach 0 or expires.
 * Marks verified = 1 on success to prevent code replay.
 */
export function verifyOtpCode(
  target: string,
  purpose: OtpPurpose,
  code: string
): { valid: boolean; error?: string } {
  const isEmail = target.includes('@');
  const normalizedTarget = isEmail ? target.trim().toLowerCase() : normalizePhone(target);
  const now = Date.now();

  const stmt = db.prepare(`
    SELECT id, otp_code, attempts_left, expires_at, verified
    FROM otps
    WHERE target = ? AND purpose = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const row = stmt.get(normalizedTarget, purpose) as {
    id: string;
    otp_code: string;
    attempts_left: number;
    expires_at: number;
    verified: number;
  } | undefined;

  if (!row) {
    return { valid: false, error: 'No verification code request found for this contact. Please request a new code.' };
  }

  if (row.verified === 1) {
    return { valid: false, error: 'This verification code has already been used. Please request a new code.' };
  }

  if (now > row.expires_at) {
    db.prepare(`DELETE FROM otps WHERE id = ?`).run(row.id);
    return { valid: false, error: 'Verification code has expired (exceeded 5-minute validity). Please request a new code.' };
  }

  if (row.attempts_left <= 0) {
    db.prepare(`DELETE FROM otps WHERE id = ?`).run(row.id);
    return { valid: false, error: 'Maximum verification attempts (3) exceeded. Please request a new verification code.' };
  }

  if (row.otp_code !== code.trim()) {
    const newAttempts = row.attempts_left - 1;
    if (newAttempts <= 0) {
      db.prepare(`DELETE FROM otps WHERE id = ?`).run(row.id);
      return { valid: false, error: 'Incorrect verification code. Maximum attempts exceeded. Please request a new code.' };
    } else {
      db.prepare(`UPDATE otps SET attempts_left = ? WHERE id = ?`).run(newAttempts, row.id);
      return { valid: false, error: `Incorrect verification code. ${newAttempts} attempt(s) remaining.` };
    }
  }

  // Success: mark verified to prevent replay
  db.prepare(`UPDATE otps SET verified = 1 WHERE id = ?`).run(row.id);
  return { valid: true };
}
