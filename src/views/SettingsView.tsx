import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  Lock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import type { UserProfile } from '../types/index.ts';

interface SettingsViewProps {
  user: UserProfile;
  onUpdateContact: (email?: string, phone?: string) => Promise<void>;
  onTriggerVerify: (type: 'email' | 'phone', target: string) => Promise<void>;
  onChangePassword: (currentPass: string, newPass: string) => Promise<void>;
  onChangeSavingsPassword: (currentPass: string, newPass: string) => Promise<void>;
}

export function SettingsView({
  user,
  onUpdateContact,
  onTriggerVerify,
  onChangePassword,
  onChangeSavingsPassword
}: SettingsViewProps) {
  // Contact editing states
  const [emailInput, setEmailInput] = useState(user.email || '');
  const [phoneInput, setPhoneInput] = useState(user.phone || '');
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [isUpdatingContact, setIsUpdatingContact] = useState(false);

  // Password change states
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMessage, setPassMessage] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Savings password change states
  const [savingsCurrent, setSavingsCurrent] = useState('');
  const [savingsNew, setSavingsNew] = useState('');
  const [savingsConfirm, setSavingsConfirm] = useState('');
  const [savingsMessage, setSavingsMessage] = useState<string | null>(null);
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [isChangingSavings, setIsChangingSavings] = useState(false);

  const handleContactSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactMessage(null);
    setContactError(null);

    const emailTrimmed = emailInput.trim();
    const phoneTrimmed = phoneInput.trim();

    if (!emailTrimmed && !phoneTrimmed) {
      setContactError('Please provide at least an email address or mobile number.');
      return;
    }

    try {
      setIsUpdatingContact(true);
      await onUpdateContact(emailTrimmed || undefined, phoneTrimmed || undefined);
      setContactMessage('Contact details saved successfully.');
    } catch (err: any) {
      setContactError(err.message || 'Failed to update contact info.');
    } finally {
      setIsUpdatingContact(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);
    setPassError(null);

    if (newPass.length < 6) {
      setPassError('New password must be at least 6 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('New passwords do not match.');
      return;
    }

    try {
      setIsChangingPass(true);
      await onChangePassword(currentPass, newPass);
      setPassMessage('Account login password updated successfully.');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleSavingsPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingsMessage(null);
    setSavingsError(null);

    if (savingsNew.length < 4) {
      setSavingsError('Savings vault PIN/password must be at least 4 characters.');
      return;
    }
    if (savingsNew !== savingsConfirm) {
      setSavingsError('Savings passwords do not match.');
      return;
    }

    try {
      setIsChangingSavings(true);
      await onChangeSavingsPassword(savingsCurrent, savingsNew);
      setSavingsMessage('Savings vault password updated successfully.');
      setSavingsCurrent('');
      setSavingsNew('');
      setSavingsConfirm('');
    } catch (err: any) {
      setSavingsError(err.message || 'Failed to update savings password.');
    } finally {
      setIsChangingSavings(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Account & Security Settings
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your login credentials, recovery contacts, and secondary savings vault security PIN.
        </p>
      </div>

      {/* Account Info Box */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-300">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Account: {user.username}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              User ID: <span className="font-mono">{user.id.slice(0, 8)}...</span> · Member since {user.created_at.slice(0, 10)}
            </p>
          </div>
        </div>
      </div>

      {/* Verified Contact Details Form */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Recovery Contacts & Login Identifiers
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Your verified email or mobile number allows you to sign in securely and reset your password if forgotten.
          </p>
        </div>

        {contactMessage && (
          <div className="p-3 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{contactMessage}</span>
          </div>
        )}

        {contactError && (
          <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{contactError}</span>
          </div>
        )}

        <form onSubmit={handleContactSave} className="space-y-4">
          {/* Email Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex-1 max-w-md">
              <label htmlFor="settings-email" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email Address
              </label>
              <input
                id="settings-email"
                type="email"
                placeholder="name@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {user.email && user.email === emailInput ? (
                user.email_verified ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Verified
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="w-3.5 h-3.5" /> Unverified
                    </span>
                    <button
                      type="button"
                      onClick={() => onTriggerVerify('email', user.email!)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs transition-colors"
                    >
                      Verify via OTP
                    </button>
                  </div>
                )
              ) : (
                <span className="text-xs text-zinc-400 italic">Unsaved changes</span>
              )}
            </div>
          </div>

          {/* Mobile Phone Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex-1 max-w-md">
              <label htmlFor="settings-phone" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Mobile Number
              </label>
              <input
                id="settings-phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {user.phone && user.phone === phoneInput ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Saved
                </span>
              ) : (
                <span className="text-xs text-zinc-400 italic">Unsaved changes</span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isUpdatingContact}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg shadow-xs transition-colors"
            >
              {isUpdatingContact ? 'Saving Contacts...' : 'Save Contacts'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Main Account Password Form */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Change Account Login Password
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Update your primary account login credentials.
          </p>
        </div>

        {passMessage && (
          <div className="p-3 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {passMessage}
          </div>
        )}

        {passError && (
          <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            {passError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="settings-current-pass" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Current Password *
            </label>
            <input
              id="settings-current-pass"
              type="password"
              required
              placeholder="••••••••"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label htmlFor="settings-new-pass" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              New Password (min 6 chars) *
            </label>
            <input
              id="settings-new-pass"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label htmlFor="settings-confirm-pass" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Confirm New Password *
            </label>
            <input
              id="settings-confirm-pass"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={isChangingPass}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg shadow-xs transition-colors"
            >
              {isChangingPass ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Change / Configure Savings Vault Password */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Savings Vault Security PIN / Password
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            An independent secondary PIN used exclusively to protect and unlock your savings ledger and reserve funds.
          </p>
        </div>

        {savingsMessage && (
          <div className="p-3 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {savingsMessage}
          </div>
        )}

        {savingsError && (
          <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            {savingsError}
          </div>
        )}

        <form onSubmit={handleSavingsPasswordSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="settings-savings-current" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Current Vault or Login Password
            </label>
            <input
              id="settings-savings-current"
              type="password"
              placeholder="••••"
              value={savingsCurrent}
              onChange={(e) => setSavingsCurrent(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label htmlFor="settings-savings-new" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              New Vault PIN (min 4 chars) *
            </label>
            <input
              id="settings-savings-new"
              type="password"
              required
              minLength={4}
              placeholder="••••"
              value={savingsNew}
              onChange={(e) => setSavingsNew(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label htmlFor="settings-savings-confirm" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Confirm Vault PIN *
            </label>
            <input
              id="settings-savings-confirm"
              type="password"
              required
              minLength={4}
              placeholder="••••"
              value={savingsConfirm}
              onChange={(e) => setSavingsConfirm(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={isChangingSavings}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg shadow-xs transition-colors"
            >
              {isChangingSavings ? 'Saving...' : 'Set Vault PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
