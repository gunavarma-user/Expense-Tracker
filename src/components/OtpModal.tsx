import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  KeyRound,
  CheckCircle2
} from 'lucide-react';

interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: string;
  purpose: 'verify_email' | 'verify_phone' | 'reset_password' | 'registration_verify';
  onVerify: (code: string, newPassword?: string) => Promise<void>;
  onResend: () => Promise<void>;
  requireNewPassword?: boolean;
}

export function OtpModal({
  isOpen,
  onClose,
  target,
  purpose,
  onVerify,
  onResend,
  requireNewPassword = false
}: OtpModalProps) {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes = 300 seconds

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setCode('');
      setNewPassword('');
      setError(null);
      setTimeLeft(300);
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeLeft]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setError('Please enter a valid 6-digit numeric code.');
      return;
    }

    if (requireNewPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onVerify(code, requireNewPassword ? newPassword : undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      setIsResending(true);
      await onResend();
      setTimeLeft(300);
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              {purpose === 'reset_password' ? 'Password Recovery' : 'Contact Verification'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <div className="space-y-3">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            A 6-digit verification code has been dispatched to{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-200">{target}</span>.
          </div>


          {error && (
            <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* OTP Code Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="otp-input" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Enter 6-Digit OTP *
              </label>
              <div className="flex items-center gap-1 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{timeFormatted}</span>
              </div>
            </div>

            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center tracking-widest text-xl font-mono py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />

            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-zinc-400 text-[11px]">
                Valid for 5 minutes · 3 attempts
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || timeLeft > 270}
                className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white disabled:opacity-40 inline-flex items-center gap-1 font-medium"
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                <span>Resend Code</span>
              </button>
            </div>
          </div>

          {/* Optional: If resetting password, prompt for new password */}
          {requireNewPassword && (
            <div className="pt-2">
              <label htmlFor="otp-new-password" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                New Account Password *
              </label>
              <input
                id="otp-new-password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              <span className="text-[11px] text-zinc-400 mt-1 block">Minimum 6 characters.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || code.length !== 6 || timeLeft === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
