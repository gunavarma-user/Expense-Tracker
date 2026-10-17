import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { queryOne, queryAll, execute, backupDatabase } from './db.ts';
import { 
  hashPassword, 
  verifyPassword, 
  createSession, 
  getSession, 
  deleteSession, 
  setSavingsUnlocked,
  createAndSendOtp,
  verifyOtpCode,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  checkRateLimit,
  resetRateLimit,
  maskContact
} from './auth.ts';
import type { 
  UserProfile, 
  Transaction, 
  SavingsTransaction 
} from '../types/index.ts';

export const apiRouter = Router();

export interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionToken?: string;
  savingsUnlocked?: boolean;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.slice(7).trim();
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  req.userId = session.user_id;
  req.sessionToken = session.token;
  req.savingsUnlocked = session.savings_unlocked;
  next();
}

function getUserProfile(userId: string): UserProfile | null {
  const row: any = queryOne(`
    SELECT id, username, email, email_verified, phone, phone_verified, savings_password_hash, created_at
    FROM users
    WHERE id = ?
  `, userId);
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    email_verified: Boolean(row.email_verified),
    phone: row.phone,
    phone_verified: Boolean(row.phone_verified),
    has_savings_password: Boolean(row.savings_password_hash),
    created_at: row.created_at
  };
}

// 1. AUTHENTICATION & MULTI-ACCOUNT

/**
 * Step 1 of Registration: Validate username and contact uniqueness, dispatch 5-minute OTP
 * Requirement: Email or Mobile verification MUST be completed before account creation.
 */
apiRouter.post('/auth/register/send-otp', async (req: Request, res: Response) => {
  try {
    const { username, contactType, contactValue } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }
    if (!contactType || (contactType !== 'email' && contactType !== 'phone')) {
      return res.status(400).json({ error: 'Please choose either email or mobile number for account verification.' });
    }
    if (!contactValue || typeof contactValue !== 'string' || !contactValue.trim()) {
      return res.status(400).json({ error: `Please provide a valid ${contactType === 'email' ? 'email address' : 'mobile number'}.` });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existingUser = queryOne(`SELECT id FROM users WHERE LOWER(username) = ?`, cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
    }

    let normalizedContact = '';
    if (contactType === 'email') {
      if (!isValidEmail(contactValue)) {
        return res.status(400).json({ error: 'Please enter a valid email address (e.g. name@example.com).' });
      }
      normalizedContact = contactValue.trim().toLowerCase();
      const existingEmail = queryOne(`SELECT id FROM users WHERE LOWER(email) = ?`, normalizedContact);
      if (existingEmail) {
        return res.status(400).json({ error: 'This email is already registered to another account.' });
      }
    } else {
      if (!isValidPhone(contactValue)) {
        return res.status(400).json({ error: 'Please enter a valid mobile number (e.g. +1234567890 or 10 digits).' });
      }
      normalizedContact = normalizePhone(contactValue);
      const existingPhone = queryOne(`SELECT id FROM users WHERE phone = ?`, normalizedContact);
      if (existingPhone) {
        return res.status(400).json({ error: 'This mobile number is already registered to another account.' });
      }
    }

    const otpRes = await createAndSendOtp(normalizedContact, 'registration_verify');
    if (!otpRes.success) {
      return res.status(400).json({ error: otpRes.error || 'Failed to dispatch verification code.' });
    }

    return res.json({
      success: true,
      message: otpRes.message,
      target: maskContact(normalizedContact)
    });
  } catch (error: any) {
    console.error('Registration OTP error:', error);
    return res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

/**
 * Step 2 of Registration: Verify OTP and create the account with verified contact status.
 * Single verified contact (Email OR Mobile) is strictly sufficient; both are never required.
 */
apiRouter.post('/auth/register/verify-and-create', (req: Request, res: Response) => {
  try {
    const { username, password, contactType, contactValue, otpCode, secondaryEmail, secondaryPhone } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!contactType || (contactType !== 'email' && contactType !== 'phone')) {
      return res.status(400).json({ error: 'Invalid contact type.' });
    }
    if (!contactValue || !otpCode) {
      return res.status(400).json({ error: 'Contact and 6-digit verification code are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const normalizedContact = contactType === 'email' ? contactValue.trim().toLowerCase() : normalizePhone(contactValue);

    // Validate OTP
    const validation = verifyOtpCode(normalizedContact, 'registration_verify', otpCode);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Double check username and contact availability
    const existingUser = queryOne(`SELECT id FROM users WHERE LOWER(username) = ?`, cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'Username was registered in the interim. Please choose another.' });
    }

    let emailVal: string | null = contactType === 'email' ? normalizedContact : null;
    let emailVerified = contactType === 'email' ? 1 : 0;
    let phoneVal: string | null = contactType === 'phone' ? normalizedContact : null;
    let phoneVerified = contactType === 'phone' ? 1 : 0;

    // Optional secondary contact: ensure empty strings are strictly stored as NULL
    if (secondaryEmail && typeof secondaryEmail === 'string' && secondaryEmail.trim()) {
      const cleanSecondaryEmail = secondaryEmail.trim().toLowerCase();
      if (!emailVal && isValidEmail(cleanSecondaryEmail)) {
        const existingEmail = queryOne(`SELECT id FROM users WHERE LOWER(email) = ?`, cleanSecondaryEmail);
        if (!existingEmail) {
          emailVal = cleanSecondaryEmail;
        }
      }
    }
    if (secondaryPhone && typeof secondaryPhone === 'string' && secondaryPhone.trim()) {
      const cleanSecondaryPhone = normalizePhone(secondaryPhone);
      if (!phoneVal && isValidPhone(cleanSecondaryPhone)) {
        const existingPhone = queryOne(`SELECT id FROM users WHERE phone = ?`, cleanSecondaryPhone);
        if (!existingPhone) {
          phoneVal = cleanSecondaryPhone;
        }
      }
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    execute(`
      INSERT INTO users (id, username, password_hash, email, email_verified, phone, phone_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, userId, cleanUsername, passwordHash, emailVal, emailVerified, phoneVal, phoneVerified, now, now);

    const { token } = createSession(userId);
    const profile = getUserProfile(userId);

    console.log(`[AUTH] User registered successfully: ${cleanUsername} (verified ${contactType})`);

    return res.status(201).json({
      message: 'Account created and verified successfully.',
      token,
      user: profile
    });
  } catch (error: any) {
    console.error('Verify and create account error:', error);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  try {
    const { username, password, email, phone } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existingUser = queryOne(`SELECT id FROM users WHERE LOWER(username) = ?`, cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
    }

    let emailVal: string | null = null;
    if (email && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address (e.g. name@example.com).' });
      }
      const existingEmail = queryOne(`SELECT id FROM users WHERE LOWER(email) = ?`, cleanEmail);
      if (existingEmail) {
        return res.status(400).json({ error: 'This email is already registered to another account.' });
      }
      emailVal = cleanEmail;
    }

    let phoneVal: string | null = null;
    if (phone && typeof phone === 'string' && phone.trim()) {
      if (!isValidPhone(phone)) {
        return res.status(400).json({ error: 'Please enter a valid mobile number (e.g. +1234567890 or 10 digits).' });
      }
      const normalizedPhone = normalizePhone(phone);
      const existingPhone = queryOne(`SELECT id FROM users WHERE phone = ?`, normalizedPhone);
      if (existingPhone) {
        return res.status(400).json({ error: 'This mobile number is already registered to another account.' });
      }
      phoneVal = normalizedPhone;
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    execute(`
      INSERT INTO users (id, username, password_hash, email, email_verified, phone, phone_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?)
    `, userId, cleanUsername, passwordHash, emailVal, phoneVal, now, now);

    const { token } = createSession(userId);
    const profile = getUserProfile(userId);

    console.log(`[AUTH] User registered successfully without OTP: ${cleanUsername}`);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: profile
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please provide identifier (username/email/phone) and password.' });
    }

    const cleanIdentifier = identifier.trim();
    const rateLimitKey = `limit:login:${cleanIdentifier.toLowerCase()}`;

    // Rate limit: max 5 failed attempts per 15 minutes
    const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many failed login attempts. Please try again after ${Math.ceil((rateCheck.retryAfterSeconds || 60) / 60)} minute(s).`
      });
    }

    let userRow: any = queryOne(`
      SELECT id, username, password_hash, email, email_verified, phone, phone_verified
      FROM users
      WHERE LOWER(username) = LOWER(?)
    `, cleanIdentifier);

    if (!userRow && isValidEmail(cleanIdentifier)) {
      userRow = queryOne(`
        SELECT id, username, password_hash, email, email_verified, phone, phone_verified
        FROM users
        WHERE LOWER(email) = LOWER(?)
      `, cleanIdentifier.toLowerCase());
    }

    if (!userRow && isValidPhone(cleanIdentifier)) {
      const normalized = normalizePhone(cleanIdentifier);
      userRow = queryOne(`
        SELECT id, username, password_hash, email, email_verified, phone, phone_verified
        FROM users
        WHERE phone = ?
      `, normalized);
    }

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify your details.' });
    }

    // Reset rate limit on successful authentication
    resetRateLimit(rateLimitKey);

    const { token } = createSession(userRow.id);
    const profile = getUserProfile(userRow.id);

    console.log(`[AUTH] User authenticated successfully: ${userRow.username}`);

    return res.json({
      message: 'Login successful.',
      token,
      user: profile
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

apiRouter.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    deleteSession(req.sessionToken);
  }
  return res.json({ message: 'Logged out successfully.' });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const profile = getUserProfile(req.userId || '');
  if (!profile) {
    return res.status(404).json({ error: 'User not found.' });
  }
  profile.savings_unlocked = req.savingsUnlocked;
  return res.json({ user: profile });
});

apiRouter.post('/auth/send-otp', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target, type } = req.body;
    if (!target) return res.status(400).json({ error: 'Contact target is required.' });

    const purpose = type === 'email' ? 'verify_email' : 'verify_phone';
    if (type === 'email' && !isValidEmail(target)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }
    if (type === 'phone' && !isValidPhone(target)) {
      return res.status(400).json({ error: 'Invalid phone number format.' });
    }

    const result = await createAndSendOtp(target, purpose);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to dispatch verification code.' });
    }
    return res.json({ success: true, message: result.message });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

apiRouter.post('/auth/verify-otp', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target, code, type } = req.body;
    if (!target || !code) {
      return res.status(400).json({ error: 'Target and 6-digit verification code are required.' });
    }

    const purpose = type === 'email' ? 'verify_email' : 'verify_phone';
    const validation = verifyOtpCode(target, purpose, code);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const now = new Date().toISOString();
    if (type === 'email') {
      execute(`
        UPDATE users 
        SET email = ?, email_verified = 1, updated_at = ?
        WHERE id = ?
      `, target.trim().toLowerCase(), now, req.userId || '');
    } else {
      const normalized = normalizePhone(target);
      execute(`
        UPDATE users 
        SET phone = ?, phone_verified = 1, updated_at = ?
        WHERE id = ?
      `, normalized, now, req.userId || '');
    }

    const updatedProfile = getUserProfile(req.userId || '');
    return res.json({
      message: `${type === 'email' ? 'Email' : 'Mobile number'} verified successfully!`,
      user: updatedProfile
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Verification failed.' });
  }
});

apiRouter.post('/auth/forgot-password/request', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ error: 'Please provide your registered email address.' });
    }

    const clean = identifier.trim();
    let emailTarget: string | null = null;

    if (isValidEmail(clean)) {
      const row: any = queryOne(`SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)`, clean);
      if (row && row.email) {
        emailTarget = row.email.toLowerCase();
      }
    } else if (isValidPhone(clean)) {
      return res.status(400).json({
        error: 'SMS password recovery is not enabled. Please enter your registered email address.'
      });
    } else {
      // Check if identifier is username
      const row: any = queryOne(`SELECT id, email FROM users WHERE LOWER(username) = LOWER(?)`, clean);
      if (row && row.email) {
        emailTarget = row.email.toLowerCase();
      }
    }

    if (emailTarget) {
      const otpRes = await createAndSendOtp(emailTarget, 'forgot_password');
      if (!otpRes.success) {
        return res.status(400).json({ error: otpRes.error || 'Failed to dispatch verification code.' });
      }
      return res.json({
        message: 'If the provided contact is registered with an account, a 5-minute verification code has been dispatched to your email.',
        target: maskContact(emailTarget)
      });
    }

    return res.json({
      message: 'If the provided contact is registered with an account, a 5-minute verification code has been dispatched to your email.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process password recovery request.' });
  }
});

apiRouter.post('/auth/forgot-password/reset', (req: Request, res: Response) => {
  try {
    const { target, code, newPassword } = req.body;
    if (!target || !code || !newPassword) {
      return res.status(400).json({ error: 'Target email, OTP code, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const cleanTarget = target.trim().toLowerCase();
    let emailTarget = cleanTarget;
    if (!isValidEmail(cleanTarget)) {
      const userByName: any = queryOne(`SELECT email FROM users WHERE LOWER(username) = LOWER(?)`, cleanTarget);
      if (userByName && userByName.email) {
        emailTarget = userByName.email.toLowerCase();
      }
    }

    const validation = verifyOtpCode(emailTarget, 'forgot_password', code);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const userRow: any = queryOne(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, emailTarget);
    if (!userRow) {
      return res.status(404).json({ error: 'Account matching registered email not found.' });
    }

    const newHash = hashPassword(newPassword);
    const now = new Date().toISOString();
    execute(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, newHash, now, userRow.id);
    execute(`DELETE FROM sessions WHERE user_id = ?`, userRow.id);

    return res.json({ message: 'Password has been reset successfully. Please log in with your new password.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

apiRouter.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user: any = queryOne(`SELECT password_hash FROM users WHERE id = ?`, req.userId || '');
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = hashPassword(newPassword);
    const now = new Date().toISOString();
    execute(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, newHash, now, req.userId || '');

    return res.json({ message: 'Password updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

apiRouter.post('/auth/update-contact', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, phone } = req.body;
    const currentUser: any = queryOne(`SELECT email, phone FROM users WHERE id = ?`, req.userId || '');
    const now = new Date().toISOString();

    if (email !== undefined) {
      const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
      if (cleanEmail && !isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email address format.' });
      }
      if (cleanEmail !== currentUser.email) {
        if (cleanEmail) {
          const existing = queryOne(`SELECT id FROM users WHERE LOWER(email) = ? AND id != ?`, cleanEmail, req.userId || '');
          if (existing) {
            return res.status(400).json({ error: 'Email already in use by another account.' });
          }
        }
        execute(`UPDATE users SET email = ?, email_verified = 0, updated_at = ? WHERE id = ?`, cleanEmail, now, req.userId || '');
      }
    }

    if (phone !== undefined) {
      const cleanPhone = phone && typeof phone === 'string' && phone.trim() ? normalizePhone(phone) : null;
      if (cleanPhone && !isValidPhone(cleanPhone)) {
        return res.status(400).json({ error: 'Invalid mobile number format.' });
      }
      if (cleanPhone !== currentUser.phone) {
        if (cleanPhone) {
          const existing = queryOne(`SELECT id FROM users WHERE phone = ? AND id != ?`, cleanPhone, req.userId || '');
          if (existing) {
            return res.status(400).json({ error: 'Mobile number already in use by another account.' });
          }
        }
        execute(`UPDATE users SET phone = ?, phone_verified = 0, updated_at = ? WHERE id = ?`, cleanPhone, now, req.userId || '');
      }
    }

    const updated = getUserProfile(req.userId || '');
    return res.json({ message: 'Contact details updated.', user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update contact info.' });
  }
});

// Disabled endpoint: removed for security protection
apiRouter.all('/auth/otp-logs', (_req: Request, res: Response) => {
  return res.status(404).json({ error: 'Endpoint disabled for security.' });
});

// 2. SAVINGS MODULE (SEPARATE PASSWORD VAULT)

apiRouter.get('/savings/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user: any = queryOne(`SELECT savings_password_hash FROM users WHERE id = ?`, req.userId || '');
  return res.json({
    has_savings_password: Boolean(user?.savings_password_hash),
    unlocked: Boolean(req.savingsUnlocked)
  });
});

apiRouter.post('/savings/setup', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, currentPassword } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Savings password/PIN must be at least 4 characters long.' });
    }

    const user: any = queryOne(`SELECT savings_password_hash, password_hash FROM users WHERE id = ?`, req.userId || '');
    if (user?.savings_password_hash && currentPassword) {
      const matchMain = verifyPassword(currentPassword, user.password_hash);
      const matchSavings = verifyPassword(currentPassword, user.savings_password_hash);
      if (!matchMain && !matchSavings) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }

    const hash = hashPassword(password);
    execute(`UPDATE users SET savings_password_hash = ? WHERE id = ?`, hash, req.userId || '');
    if (req.sessionToken) {
      setSavingsUnlocked(req.sessionToken, true);
    }

    return res.json({ message: 'Savings vault password configured successfully.', unlocked: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to configure savings password.' });
  }
});

apiRouter.post('/savings/unlock', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Savings password is required.' });
    }

    const rateLimitKey = `limit:savings:${req.userId}`;
    // Max 5 attempts per 15 minutes to protect 4-digit PINs from brute force
    const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many incorrect attempts. Savings vault access is temporarily locked for ${Math.ceil((rateCheck.retryAfterSeconds || 60) / 60)} minute(s).`
      });
    }

    const user: any = queryOne(`SELECT savings_password_hash FROM users WHERE id = ?`, req.userId || '');
    if (!user || !user.savings_password_hash) {
      return res.status(400).json({ error: 'No savings password configured yet. Please set one up first.' });
    }

    const isValid = verifyPassword(password, user.savings_password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect savings password.' });
    }

    // Reset failed unlock attempts on correct password
    resetRateLimit(rateLimitKey);

    if (req.sessionToken) {
      setSavingsUnlocked(req.sessionToken, true);
    }

    return res.json({ message: 'Savings vault unlocked for this session.', unlocked: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to unlock savings vault.' });
  }
});

apiRouter.post('/savings/lock', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    setSavingsUnlocked(req.sessionToken, false);
  }
  return res.json({ message: 'Savings vault locked.', unlocked: false });
});

function requireSavingsUnlocked(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.savingsUnlocked) {
    return res.status(403).json({ error: 'Savings vault is locked. Please enter your savings password to access.' });
  }
  next();
}

apiRouter.get('/savings/transactions', requireAuth, requireSavingsUnlocked, (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows: SavingsTransaction[] = queryAll(`
      SELECT id, user_id, date, type, amount, description, source, created_at
      FROM savings_transactions
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
    `, req.userId || '');

    let totalDeposited = 0;
    let totalWithdrawn = 0;

    for (const row of rows) {
      if (row.type === 'deposit') totalDeposited += row.amount;
      if (row.type === 'withdrawal') totalWithdrawn += row.amount;
    }

    const balance = Math.max(0, totalDeposited - totalWithdrawn);

    return res.json({
      transactions: rows,
      balance: Math.round(balance * 100) / 100,
      totalDeposited: Math.round(totalDeposited * 100) / 100,
      totalWithdrawn: Math.round(totalWithdrawn * 100) / 100
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve savings data.' });
  }
});

apiRouter.post('/savings/transactions', requireAuth, requireSavingsUnlocked, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, type, amount, description, source } = req.body;
    if (!date || !type || amount === undefined || !description) {
      return res.status(400).json({ error: 'Date, type, amount, and description are required.' });
    }
    if (type !== 'deposit' && type !== 'withdrawal') {
      return res.status(400).json({ error: 'Type must be deposit or withdrawal.' });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    if (type === 'withdrawal') {
      const summary: any = queryOne(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) AS dep,
          COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) AS withdr
        FROM savings_transactions
        WHERE user_id = ?
      `, req.userId || '');

      const currentSavings = summary.dep - summary.withdr;
      if (numAmount > currentSavings) {
        return res.status(400).json({ error: `Withdrawal amount (₹${numAmount}) exceeds current savings balance (₹${currentSavings}).` });
      }
    }

    const txId = crypto.randomUUID();
    const cleanSource = source === 'external' ? 'external' : 'balance';
    const now = new Date().toISOString();

    execute(`
      INSERT INTO savings_transactions (id, user_id, date, type, amount, description, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, txId, req.userId || '', date, type, Math.round(numAmount * 100) / 100, description.trim(), cleanSource, now);

    return res.status(201).json({ message: 'Savings entry recorded successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record savings entry.' });
  }
});

// 3. TRANSACTIONS MANAGEMENT

apiRouter.get('/transactions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, type, category, search, sortBy } = req.query;

    let sql = `
      SELECT id, user_id, date, title, amount, type, category, payment_method, notes, is_sample, created_at, updated_at
      FROM transactions
      WHERE user_id = ?
    `;
    const params: any[] = [req.userId || ''];

    if (startDate) {
      sql += ` AND date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND date <= ?`;
      params.push(endDate);
    }
    if (type && type !== 'all') {
      sql += ` AND type = ?`;
      params.push(type);
    }
    if (category && category !== 'all') {
      sql += ` AND category = ?`;
      params.push(category);
    }
    if (search) {
      sql += ` AND (LOWER(title) LIKE ? OR LOWER(notes) LIKE ?)`;
      params.push(`%${String(search).toLowerCase()}%`, `%${String(search).toLowerCase()}%`);
    }

    if (sortBy === 'amount_desc') {
      sql += ` ORDER BY amount DESC, date DESC`;
    } else if (sortBy === 'amount_asc') {
      sql += ` ORDER BY amount ASC, date ASC`;
    } else if (sortBy === 'date_asc') {
      sql += ` ORDER BY date ASC, created_at ASC`;
    } else {
      sql += ` ORDER BY date DESC, created_at DESC`;
    }

    const rows: any[] = queryAll(sql, ...params);
    const formatted: Transaction[] = rows.map(r => ({
      ...r,
      is_sample: Boolean(r.is_sample)
    }));

    return res.json({ transactions: formatted });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

apiRouter.post('/transactions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, title, amount, type, category, payment_method, notes } = req.body;
    if (!date || !title || amount === undefined || !type || !category || !payment_method) {
      return res.status(400).json({ error: 'Date, title, amount, type, category, and payment method are required.' });
    }
    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({ error: 'Type must be income or expense.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    execute(`
      INSERT INTO transactions (id, user_id, date, title, amount, type, category, payment_method, notes, is_sample, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, id, req.userId || '', date, title.trim(), Math.round(numAmount * 100) / 100, type, category, payment_method, notes ? notes.trim() : null, now, now);

    const created: any = queryOne(`SELECT * FROM transactions WHERE id = ?`, id);
    return res.status(201).json({
      message: 'Transaction recorded successfully.',
      transaction: { ...created, is_sample: Boolean(created?.is_sample) }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record transaction.' });
  }
});

apiRouter.put('/transactions/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date, title, amount, type, category, payment_method, notes } = req.body;

    const existing: any = queryOne(`SELECT id, user_id FROM transactions WHERE id = ?`, id);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    if (existing.user_id !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized to modify this transaction.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    const now = new Date().toISOString();
    execute(`
      UPDATE transactions
      SET date = ?, title = ?, amount = ?, type = ?, category = ?, payment_method = ?, notes = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `, date, title.trim(), Math.round(numAmount * 100) / 100, type, category, payment_method, notes ? notes.trim() : null, now, id, req.userId || '');

    const updated: any = queryOne(`SELECT * FROM transactions WHERE id = ?`, id);
    return res.json({
      message: 'Transaction updated successfully.',
      transaction: { ...updated, is_sample: Boolean(updated?.is_sample) }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

apiRouter.delete('/transactions/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing: any = queryOne(`SELECT id, user_id FROM transactions WHERE id = ?`, id);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    if (existing.user_id !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this transaction.' });
    }

    execute(`DELETE FROM transactions WHERE id = ? AND user_id = ?`, id, req.userId || '');
    return res.json({ message: 'Transaction deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete transaction.' });
  }
});

// 4. SAMPLE DATA SEEDING & REMOVAL

apiRouter.post('/sample-data/seed', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const prevMonthNum = new Date().getMonth() === 0 ? 12 : new Date().getMonth();
    const prevYearNum = new Date().getMonth() === 0 ? currentYear - 1 : currentYear;
    const prevMonth = String(prevMonthNum).padStart(2, '0');

    const sampleRecords = [
      { date: `${prevYearNum}-${prevMonth}-02`, title: 'Monthly Parent Allowance', amount: 12000, type: 'income', category: 'Monthly Allowance', payment: 'Net Banking', notes: 'Monthly allowance' },
      { date: `${prevYearNum}-${prevMonth}-03`, title: 'College Mess & Canteen Fee', amount: 2400, type: 'expense', category: 'Food & Canteen', payment: 'UPI / QR', notes: 'Monthly mess card renewal' },
      { date: `${prevYearNum}-${prevMonth}-05`, title: 'Semester Lab Manual & Stationery', amount: 450, type: 'expense', category: 'Books & Stationery', payment: 'Cash', notes: 'CSE Lab record books' },
      { date: `${prevYearNum}-${prevMonth}-08`, title: 'Metro Smart Card Recharge', amount: 500, type: 'expense', category: 'Transport & Metro', payment: 'UPI / QR', notes: 'Commute for college' },
      { date: `${prevYearNum}-${prevMonth}-15`, title: 'Freelance React Dashboard Stipend', amount: 8500, type: 'income', category: 'Freelance / Project Stipend', payment: 'Net Banking', notes: 'Contract payment' },
      { date: `${prevYearNum}-${prevMonth}-20`, title: 'Campus Canteen Snacks', amount: 350, type: 'expense', category: 'Food & Canteen', payment: 'UPI / QR', notes: 'Study snacks' },
      { date: `${prevYearNum}-${prevMonth}-25`, title: 'Cloud Server & Dev Subscription', amount: 499, type: 'expense', category: 'Tech & Subscriptions', payment: 'Debit Card', notes: 'Dev tools subscription' },
      { date: `${currentYear}-${currentMonth}-01`, title: 'Monthly Parent Allowance', amount: 12000, type: 'income', category: 'Monthly Allowance', payment: 'Net Banking', notes: 'Monthly allowance' },
      { date: `${currentYear}-${currentMonth}-03`, title: 'College Mess & Canteen Food', amount: 2800, type: 'expense', category: 'Food & Canteen', payment: 'UPI / QR', notes: 'Canteen food' },
      { date: `${currentYear}-${currentMonth}-05`, title: 'AI/ML Reference Textbook', amount: 850, type: 'expense', category: 'Books & Stationery', payment: 'Debit Card', notes: 'Pattern recognition textbook' },
      { date: `${currentYear}-${currentMonth}-07`, title: 'Metro Transit Pass', amount: 600, type: 'expense', category: 'Transport & Metro', payment: 'UPI / QR', notes: 'Monthly travel pass' },
      { date: `${currentYear}-${currentMonth}-10`, title: 'Hardware Components for Lab Project', amount: 1500, type: 'expense', category: 'Tuition & Lab Fees', payment: 'Debit Card', notes: 'Sensors and kit' },
      { date: `${currentYear}-${currentMonth}-12`, title: 'Weekend Group Hackathon Dinner', amount: 950, type: 'expense', category: 'Entertainment & Leisure', payment: 'UPI / QR', notes: 'Post-hackathon dinner' },
      { date: `${currentYear}-${currentMonth}-14`, title: 'College Merit Scholarship Award', amount: 5000, type: 'income', category: 'Scholarship / Grant', payment: 'Net Banking', notes: 'Academic reward' }
    ];

    for (const s of sampleRecords) {
      const now = new Date().toISOString();
      execute(`
        INSERT INTO transactions (id, user_id, date, title, amount, type, category, payment_method, notes, is_sample, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, crypto.randomUUID(), req.userId || '', s.date, s.title, s.amount, s.type, s.category, s.payment, s.notes, now, now);
    }

    return res.json({ message: 'Loaded 14 sample transactions successfully. You can remove them anytime.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to seed sample dataset.' });
  }
});

apiRouter.post('/sample-data/clear', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = execute(`DELETE FROM transactions WHERE user_id = ? AND is_sample = 1`, req.userId || '');
    return res.json({ message: `Removed ${result?.changes || 0} sample records. Real data was preserved.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to clear sample dataset.' });
  }
});

// 5. BACKUP, EXPORT & RESTORE

apiRouter.get('/backup/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = getUserProfile(req.userId || '');
    const transactions = queryAll(`SELECT * FROM transactions WHERE user_id = ?`, req.userId || '');
    const savings = queryAll(`SELECT * FROM savings_transactions WHERE user_id = ?`, req.userId || '');

    const payload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      user: {
        username: profile?.username,
        email: profile?.email,
        phone: profile?.phone
      },
      transactions,
      savings_transactions: savings
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="expense_analyzer_${profile?.username}_backup.json"`);
    return res.json(payload);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export backup.' });
  }
});

apiRouter.post('/backup/import', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Invalid backup file format. Expected transactions array.' });
    }

    let importedCount = 0;
    for (const t of transactions) {
      if (t.date && t.title && t.amount && t.type && t.category) {
        const id = t.id || crypto.randomUUID();
        const now = new Date().toISOString();
        execute(`
          INSERT OR REPLACE INTO transactions (id, user_id, date, title, amount, type, category, payment_method, notes, is_sample, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `, id, req.userId || '', t.date, t.title, Number(t.amount), t.type, t.category, t.payment_method || 'Cash', t.notes || null, t.created_at || now, now);
        importedCount++;
      }
    }

    return res.json({ message: `Successfully imported ${importedCount} transactions.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to import backup data.' });
  }
});

apiRouter.post('/backup/server-db', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const backupPath = backupDatabase();
    return res.json({
      message: 'Physical SQLite database snapshot created successfully.',
      backup_file: backupPath
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create database snapshot.' });
  }
});
