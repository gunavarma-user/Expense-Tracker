import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  normalizePhone, 
  isValidPhone, 
  checkRateLimit, 
  checkCooldown, 
  resetRateLimit, 
  createAndSendOtp,
  maskContact 
} from './auth.ts';

test('Security: Phone normalization handles domestic trunk zeros, formatting, and international E.164', () => {
  assert.equal(normalizePhone('+1 (555) 123-4567'), '+15551234567');
  assert.equal(normalizePhone('09876543210'), '9876543210');
  assert.equal(normalizePhone('9876-543-210'), '9876543210');
  assert.equal(isValidPhone('+919876543210'), true);
  assert.equal(isValidPhone('9876543210'), true);
  assert.equal(isValidPhone('09876543210'), true);
  assert.equal(isValidPhone('123'), false);
  assert.equal(isValidPhone('not-a-phone'), false);
});

test('Security: Masking protects sensitive emails and phone numbers in logs', () => {
  assert.equal(maskContact('student@college.edu'), 'st***@college.edu');
  assert.equal(maskContact('ab@domain.com'), '**@domain.com');
  assert.equal(maskContact('+919876543210'), '***3210');
  assert.equal(maskContact('1234'), '****');
});

test('Security: Persistent SQLite rate limiter blocks after threshold and resets properly', () => {
  const key = 'test-rate-limit-' + Date.now();
  resetRateLimit(key);

  // Allow up to 3 attempts
  assert.equal(checkRateLimit(key, 3, 60000).allowed, true);
  assert.equal(checkRateLimit(key, 3, 60000).allowed, true);
  assert.equal(checkRateLimit(key, 3, 60000).allowed, true);

  // 4th attempt should be blocked
  const blocked = checkRateLimit(key, 3, 60000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds && blocked.retryAfterSeconds > 0);

  // Resetting allows requests again
  resetRateLimit(key);
  assert.equal(checkRateLimit(key, 3, 60000).allowed, true);
});

test('Security: Persistent cooldown blocks repeated requests within cooldown window', () => {
  const key = 'test-cooldown-' + Date.now();
  resetRateLimit(key);

  // First request allowed
  assert.equal(checkCooldown(key, 5000).allowed, true);

  // Immediate second request blocked by cooldown
  const blocked = checkCooldown(key, 5000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.waitSeconds && blocked.waitSeconds > 0);
});

test('Security: Unconfigured providers return clear errors instead of false success', async () => {
  // Test Email when unconfigured
  const emailRes = await createAndSendOtp('unconfigured@example.com', 'registration_verify', { skipRateLimit: true });
  assert.equal(emailRes.success, false);
  assert.match(emailRes.error || '', /Email delivery provider is not configured/);

  // Test Mobile when unconfigured
  const phoneRes = await createAndSendOtp('+19999999999', 'registration_verify', { skipRateLimit: true });
  assert.equal(phoneRes.success, false);
  assert.match(phoneRes.error || '', /SMS service is not configured/);
});
