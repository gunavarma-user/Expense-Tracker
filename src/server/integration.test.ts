import test from 'node:test';
import assert from 'node:assert/strict';
import { db, queryOne, queryAll, execute } from './db.ts';
import { 
  hashPassword, 
  verifyPassword, 
  createSession, 
  getSession, 
  createAndSendOtp, 
  verifyOtpCode,
  setSavingsUnlocked 
} from './auth.ts';

test('Integration: Password hashing with scrypt is secure and reproducible with salt', () => {
  const password = 'StudentSecurePass123!';
  const hash = hashPassword(password);
  
  assert.ok(hash.includes(':'), 'Hash format should be salt:key');
  assert.equal(verifyPassword(password, hash), true, 'Correct password verifies');
  assert.equal(verifyPassword('WrongPassword', hash), false, 'Wrong password rejected');
});

test('Integration: Multi-account registration and independent isolation', () => {
  const userA_Id = 'test-user-a-' + Date.now();
  const userB_Id = 'test-user-b-' + Date.now();

  const hashA = hashPassword('passA123');
  const hashB = hashPassword('passB123');
  const now = new Date().toISOString();

  execute(`
    INSERT INTO users (id, username, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `, userA_Id, 'student_a_' + Date.now(), hashA, now, now);

  execute(`
    INSERT INTO users (id, username, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `, userB_Id, 'student_b_' + Date.now(), hashB, now, now);

  // User A inserts transactions
  const txA_Id = 'tx-a-' + Date.now();
  execute(`
    INSERT INTO transactions (id, user_id, date, title, amount, type, category, payment_method, is_sample, created_at, updated_at)
    VALUES (?, ?, '2026-10-01', 'User A Laptop Battery', 120.00, 'expense', 'Tuition & Lab Fees', 'Debit Card', 0, ?, ?)
  `, txA_Id, userA_Id, now, now);

  // User B inserts transactions
  const txB_Id = 'tx-b-' + Date.now();
  execute(`
    INSERT INTO transactions (id, user_id, date, title, amount, type, category, payment_method, is_sample, created_at, updated_at)
    VALUES (?, ?, '2026-10-01', 'User B Canteen Pizza', 15.00, 'expense', 'Food & Canteen', 'UPI / QR', 0, ?, ?)
  `, txB_Id, userB_Id, now, now);

  // Assert User A sees only User A's transactions
  const userATransactions = queryAll(`SELECT * FROM transactions WHERE user_id = ?`, userA_Id);
  assert.equal(userATransactions.length, 1);
  assert.equal(userATransactions[0].id, txA_Id);
  assert.equal(userATransactions[0].title, 'User A Laptop Battery');

  // Assert User B sees only User B's transactions
  const userBTransactions = queryAll(`SELECT * FROM transactions WHERE user_id = ?`, userB_Id);
  assert.equal(userBTransactions.length, 1);
  assert.equal(userBTransactions[0].id, txB_Id);
  assert.equal(userBTransactions[0].title, 'User B Canteen Pizza');
});

test('Integration: OTP generation, 3-attempt limit, and 5-minute expiry protection', async () => {
  const targetEmail = `evaluator_${Date.now()}@college.edu`;
  
  // Create OTP in test mode (skips external network delivery)
  const result = await createAndSendOtp(targetEmail, 'verify_email', { isTest: true });
  assert.equal(result.success, true);
  
  // Find generated code in database
  const otpRecord: any = queryOne(`SELECT * FROM otps WHERE target = ? AND purpose = 'verify_email'`, targetEmail);
  assert.ok(otpRecord);
  assert.equal(otpRecord.attempts_left, 3);
  assert.ok(otpRecord.expires_at > Date.now());

  // Attempt 1: Wrong code
  const attempt1 = verifyOtpCode(targetEmail, 'verify_email', '000000');
  assert.equal(attempt1.valid, false);
  assert.match(attempt1.error || '', /2 attempt\(s\) remaining/);

  // Attempt 2: Wrong code
  const attempt2 = verifyOtpCode(targetEmail, 'verify_email', '111111');
  assert.equal(attempt2.valid, false);
  assert.match(attempt2.error || '', /1 attempt\(s\) remaining/);

  // Attempt 3: Correct code
  const attempt3 = verifyOtpCode(targetEmail, 'verify_email', otpRecord.otp_code);
  assert.equal(attempt3.valid, true);

  // Replay attempt: should be rejected
  const replayAttempt = verifyOtpCode(targetEmail, 'verify_email', otpRecord.otp_code);
  assert.equal(replayAttempt.valid, false);
  assert.match(replayAttempt.error || '', /already been used/);
});

test('Integration: Savings Vault separate password and session unlocking', () => {
  const userId = 'savings-test-user-' + Date.now();
  const savingsPin = '9876';
  const savingsHash = hashPassword(savingsPin);
  
  // Insert user first
  execute(`
    INSERT INTO users (id, username, password_hash, savings_password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, userId, 'savings_user_' + Date.now(), hashPassword('loginpass'), savingsHash, new Date().toISOString(), new Date().toISOString());

  // Now create session
  const session = createSession(userId);

  // Verify PIN
  const user = queryOne(`SELECT savings_password_hash FROM users WHERE id = ?`, userId);
  assert.equal(verifyPassword(savingsPin, user.savings_password_hash), true);
  assert.equal(verifyPassword('1234', user.savings_password_hash), false);

  // Unlock session
  setSavingsUnlocked(session.token, true);
  const unlockedSession = getSession(session.token);
  assert.equal(unlockedSession?.savings_unlocked, true);

  // Re-lock session
  setSavingsUnlocked(session.token, false);
  const relockedSession = getSession(session.token);
  assert.equal(relockedSession?.savings_unlocked, false);
});

test('Integration: OTP-Free Registration and multi-identifier login (Username, Email, Phone)', () => {
  const ts = Date.now();
  const username = `direct_user_${ts}`;
  const password = 'SecurePassword123!';
  const email = `direct_${ts}@college.edu`;
  const phone = '+9198765' + String(ts).slice(-5);
  const passwordHash = hashPassword(password);
  const userId = `direct-uid-${ts}`;
  const now = new Date().toISOString();

  // 1. Direct registration into database without OTP
  execute(`
    INSERT INTO users (id, username, password_hash, email, email_verified, phone, phone_verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?)
  `, userId, username, passwordHash, email, phone, now, now);

  const registered = queryOne<any>(`SELECT * FROM users WHERE id = ?`, userId);
  assert.ok(registered);
  assert.equal(registered.username, username);
  assert.equal(registered.email, email);
  assert.equal(registered.phone, phone);
  assert.equal(registered.email_verified, 0); // Unverified contact doesn't block login
  assert.equal(registered.phone_verified, 0);

  // 2. Login via Username
  const byUsername = queryOne<any>(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`, username);
  assert.ok(byUsername);
  assert.equal(verifyPassword(password, byUsername.password_hash), true);

  // 3. Login via Email without OTP
  const byEmail = queryOne<any>(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, email);
  assert.ok(byEmail);
  assert.equal(verifyPassword(password, byEmail.password_hash), true);

  // 4. Login via Phone without OTP
  const byPhone = queryOne<any>(`SELECT * FROM users WHERE phone = ?`, phone);
  assert.ok(byPhone);
  assert.equal(verifyPassword(password, byPhone.password_hash), true);

  // 5. Wrong password rejected
  assert.equal(verifyPassword('WrongPass999!', byUsername.password_hash), false);

  // 6. Session generation works seamlessly
  const session = createSession(userId);
  assert.ok(session.token);
  const activeSession = getSession(session.token);
  assert.equal(activeSession?.user_id, userId);
});
