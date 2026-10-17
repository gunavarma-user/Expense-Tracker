# Personal Expense Pattern Analyzer

A full-stack, production-grade personal finance application developed for a 2nd-year BTech CSE (AI/ML) laboratory project. Features secure multi-account authentication, dual-channel OTP verification with expiration and attempt rate limiting, a secondary password-protected Savings Vault, and exploratory data analysis (EDA) spending pattern recognition.

---

## Key Features

- **Multi-Account Authentication**:
  - Independent user accounts with scrypt PBKDF password hashing (unique 16-byte cryptographic salt).
  - Direct, instant account registration with username and password (optional email and mobile number).
  - Flexible login via username, email address, or mobile number.
  - Persistent SQLite-backed rate limiting (max 5 failed login attempts per 15-minute window).
  - Secure email-based password recovery ("Forgot Password") with 5-minute expiring OTP tokens and 3-attempt limit (requires SMTP host credentials or API key configured in `.env`; returns clear configuration error if unconfigured).
  - Optional email and mobile contact verification under Account Settings (requires configured SMTP or Twilio provider).
- **Data Isolation & Relational Persistence**:
  - Built with Node.js 22 native `node:sqlite` in WAL (Write-Ahead Logging) mode.
  - Foreign-key enforced isolation between user accounts.
  - Data remains intact across application restarts, logouts, and schema updates.
  - Persistent database rate limits table (`rate_limits`) surviving server restarts.
- **Dedicated Savings Vault**:
  - Secondary password/PIN protection separate from login credentials with dedicated rate limiting.
  - Unlocked once per visit/session; automatically locks upon logout or new session.
  - Internal transfer accounting: deposits from main balance and withdrawals back to balance avoid double-counting in income/expense summaries.
- **Transaction Ledger**:
  - Stable, non-colliding UUIDs (`crypto.randomUUID()`).
  - Search, date range filtering, category filtering, payment method filtering, sorting.
  - Export to CSV format.
- **Exploratory Data Analysis (EDA) & Spending Patterns**:
  - Month-over-Month (MoM) spending variation detection.
  - Weekend spending clustering vs weekday baselines ($R_{weekend} \ge 1.35$).
  - Statistical outlier transaction detection ($T_{outlier} \ge 2.2 \times \mu$).
  - Spending by category breakdown with visual split bars.
  - Day-of-week expenditure radar.
- **Student Laboratory Dataset Manager**:
  - 1-click loading of realistic student expenses (mess fee, textbooks, metro card, freelance stipend, hackathon meal).
  - Explicitly removable with zero residue or interference with real user data.
- **Professional Financial Tool UI/UX**:
  - Restrained, human-designed aesthetic (no generic AI template slop or excessive glassmorphism).
  - Dark mode and light mode with local persistence.
  - Responsive layout for desktop and mobile viewports.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Lucide React |
| **Backend Engine** | Node.js 22 LTS, Express 4 |
| **Database** | Node 22 native SQLite (`node:sqlite` `DatabaseSync`) with WAL mode |
| **Cryptography** | Node native `crypto.scryptSync`, `crypto.randomBytes`, `crypto.timingSafeEqual` |
| **Bundling / Dev Server** | Vite 8 with Express middleware integration |
| **Testing** | Node.js native test runner (`node:test`, `node:assert/strict`) |

---

## Quick Start (Windows & Linux)

### 1. Prerequisites
- Node.js 22.x LTS or higher
- npm 10.x or higher

### 2. Installation
```bash
git clone <repository-url>
cd personal-expense-pattern-analyzer
npm install
```

### 3. Run Logic & Integration Tests
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## Testing Scenarios Verified (16/16 Automated Tests Passing)
- [x] Direct account registration with scrypt password hashing (unique 16-byte salt)
- [x] Flexible login via username, email, and normalized mobile number
- [x] Persistent SQLite rate limiting (locks after 5 failures for 15 minutes, resets on success)
- [x] Persistent 60-second cooldown protection on verification dispatches
- [x] Phone number normalization handling domestic trunk zeros, formatting, and international E.164
- [x] Sensitive contact and credential masking in security logs
- [x] Unconfigured provider safety (returns clear configuration errors instead of false success)
- [x] 5-minute OTP expiration, 3-attempt limit lockout, and single-use replay protection
- [x] Email-focused password recovery ("Forgot Password") and reset validation (requires SMTP configuration for live delivery; verified that unconfigured state safely errors)
- [x] Complete multi-account data isolation across separate user IDs
- [x] Savings vault independent PIN protection, session unlock, and auto-lock
- [x] Transaction CRUD with stable UUIDs and balance accounting
- [x] Mathematical financial summary preventing duplicate transfer counts
- [x] Categorical expense aggregation and sorting ($\sum P_i = 100\%$)
- [x] Month-over-month chronological trend detection
- [x] Algorithmic spending pattern insights (weekend surge, outlier detection) without data fabrication
- [x] SQLite WAL database persistence across server restarts
