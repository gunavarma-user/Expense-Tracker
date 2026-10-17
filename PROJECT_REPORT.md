# COLLEGE LABORATORY PROJECT REPORT

## PROJECT TITLE: PERSONAL EXPENSE PATTERN ANALYZER
**Course:** BTech Computer Science & Engineering (Artificial Intelligence and Machine Learning)  
**Year / Semester:** 2nd Year / IV Semester  
**Subject:** Full-Stack Web Development & Data Science Laboratory  

---

### 1. OBJECTIVES & PROBLEM STATEMENT

#### 1.1 Problem Statement
College students and young professionals frequently face difficulties tracking and regulating daily expenditure. Existing personal finance applications often suffer from:
1. Vulnerable authentication architectures lacking verified recovery contacts.
2. Inability to protect reserved savings from casual viewing when sharing a device.
3. Artificial data distortion where internal fund transfers are incorrectly double-counted as expenses or income.
4. Superficial dashboards displaying generic graphs without algorithmic pattern detection.

#### 1.2 Project Objectives
1. Implement a secure multi-account personal finance management system with direct, friction-free registration and multi-identifier login (username, email, or mobile number).
2. Enforce persistent, database-backed rate limiting against brute-force attacks across logins, password recovery, and savings PIN checks.
3. Build an independent, password-protected Savings Vault with dual-layer security and internal transfer accounting.
4. Provide email-based password recovery ("Forgot Password") protected with 5-minute expiring single-use OTP tokens and attempt counters.
5. Formulate exploratory data analysis (EDA) algorithms to detect month-over-month shifts, weekend outlay clustering, and statistical outliers without data hallucination.
6. Provide permanent SQLite persistence with Write-Ahead Logging (WAL) and foreign-key isolation.

---

### 2. SYSTEM ARCHITECTURE & MODULES

```
+-------------------------------------------------------+
|                    Client Layer                       |
|   React 19 SPA + TypeScript + Tailwind CSS UI Shell   |
|   (Dashboard, Transactions, Savings, Analytics, Viva) |
+-------------------------------------------------------+
                           |  HTTP / REST (JSON)
                           v
+-------------------------------------------------------+
|                    Server Layer                       |
|   Express 4 Server + Vite Middleware (server.ts)      |
|   - Auth Middleware & Session Engine                  |
|   - Cryptographic Scrypt Key Derivation               |
|   - Persistent SQLite Rate Limiter & Cooldown         |
|   - Real SMTP Email & Twilio SMS Dispatchers          |
+-------------------------------------------------------+
                           |  Node 22 DatabaseSync
                           v
+-------------------------------------------------------+
|                    Database Layer                     |
|   SQLite 3 with WAL Mode (./data/expense_analyzer.db) |
|   - users, sessions, transactions, savings, otps,     |
|     rate_limits                                       |
+-------------------------------------------------------+
```

#### Module 1: Authentication & Recovery Service
- Key derivation using `crypto.scryptSync(password, salt, 64)`.
- Unique 16-byte cryptographically secure random salt per user.
- Constant-time hash verification via `crypto.timingSafeEqual` preventing timing attacks.
- Direct account registration without mandatory OTP friction; optional email/mobile stored as unique identifiers.
- Flexible login via username, email address, or mobile number.
- Persistent database-backed rate limiting (max 5 failed attempts per 15 minutes) with automatic reset upon successful authentication.
- Single-use 6-digit cryptographic OTP generation with 5-minute validity timestamp and max 3 verification attempts for password recovery and optional contact verification.
- Real SMTP/API (Resend/SendGrid) and Twilio SMS delivery engines returning explicit configuration errors when unconfigured.

#### Module 2: Transaction Ledger & Relational Accounting
- Globally unique UUID v4 primary keys (`crypto.randomUUID()`).
- Categorization across academic, living, and discretionary categories.
- Dual-direction flow accounting preventing double-counting on savings transfers.

#### Module 3: Password-Protected Savings Reserve
- Secondary password hash stored in `users.savings_password_hash`.
- Independent persistent rate limiting on savings PIN unlock attempts.
- Session unlock flag (`sessions.savings_unlocked`) with automatic re-locking on logout or session termination.

#### Module 4: Algorithmic Pattern Analysis (EDA)
- **Month-over-Month Variance:** $\Delta_{MoM} = \frac{\text{Spend}_{t} - \text{Spend}_{t-1}}{\text{Spend}_{t-1}} \times 100\%$
- **Outlier Outlay Spike:** $T_{outlier} = 2.2 \times \mu_{expense}$
- **Weekend Velocity Clustering:** $R_{weekend} = \frac{\bar{X}_{Sat,Sun}}{\bar{X}_{Mon..Fri}}$

---

### 3. DATABASE SCHEMA DESIGN

| Table | Column Name | Data Type | Constraints | Description |
|---|---|---|---|---|
| `users` | `id` | TEXT | PRIMARY KEY | UUID identifier |
| | `username` | TEXT | UNIQUE, NOT NULL | Account login handle |
| | `password_hash` | TEXT | NOT NULL | Salt:scrypt hash |
| | `email` | TEXT | UNIQUE, NULLABLE | Optional contact email |
| | `email_verified`| INTEGER| DEFAULT 0 | Verification status |
| | `phone` | TEXT | UNIQUE, NULLABLE | Optional contact phone |
| | `phone_verified`| INTEGER| DEFAULT 0 | Verification status |
| | `savings_password_hash` | TEXT | NULLABLE | Secondary vault PIN hash |
| `sessions` | `token` | TEXT | PRIMARY KEY | 64-char hex session token |
| | `user_id` | TEXT | FOREIGN KEY -> users(id) | Associated user account |
| | `savings_unlocked` | INTEGER | DEFAULT 0 | Vault unlock state |
| | `created_at` | TEXT | NOT NULL | ISO creation timestamp |
| | `expires_at` | INTEGER | NOT NULL | UNIX expiration ms (7 days) |
| `rate_limits` | `key` | TEXT | PRIMARY KEY | Identifier/action rate key |
| | `attempts` | INTEGER | NOT NULL | Failed attempt counter |
| | `last_attempt` | INTEGER | NOT NULL | UNIX timestamp ms |
| `transactions` | `id` | TEXT | PRIMARY KEY | Transaction UUID |
| | `user_id` | TEXT | FOREIGN KEY -> users(id) | Isolated user owner |
| | `date` | TEXT | NOT NULL | ISO date (YYYY-MM-DD) |
| | `title` | TEXT | NOT NULL | Description |
| | `amount` | REAL | NOT NULL (> 0) | Monetary value |
| | `type` | TEXT | 'income' \| 'expense' | Cashflow direction |
| | `category` | TEXT | NOT NULL | Expense category |
| | `payment_method`| TEXT | NOT NULL | UPI / Card / Cash |
| `savings_transactions` | `id` | TEXT | PRIMARY KEY | Vault transaction UUID |
| | `user_id` | TEXT | FOREIGN KEY -> users(id) | Isolated user owner |
| | `date` | TEXT | NOT NULL | ISO date |
| | `type` | TEXT | 'deposit' \| 'withdrawal' | Operation |
| | `amount` | REAL | NOT NULL | Amount |
| | `source` | TEXT | 'balance' \| 'external' | Flow origin |
| `otps` | `id` | TEXT | PRIMARY KEY | UUID |
| | `target` | TEXT | NOT NULL | Email or phone |
| | `purpose` | TEXT | NOT NULL | Intent |
| | `otp_code` | TEXT | NOT NULL | 6-digit numeric |
| | `attempts_left`| INTEGER | DEFAULT 3 | Rate-limiting counter |
| | `expires_at` | INTEGER | NOT NULL | UNIX timestamp ms |
| | `verified` | INTEGER | DEFAULT 0 | Single-use flag |

---

### 4. TEST METHODOLOGY & RESULTS

A comprehensive automated testing suite (`npm test` / Node test runner) was executed:
1. **Phone Normalization & Masking:** Verified domestic trunk zero removal, international E.164 normalization, and safe log masking for emails and mobile numbers.
2. **Persistent SQLite Rate Limiting:** Verified rate-limiting threshold enforcement (5 attempts / 15 min), cooldown prevention, and atomic reset on success.
3. **Provider Configuration Safety:** Verified unconfigured SMTP/Twilio providers return clear, descriptive errors rather than false success.
4. **Cryptographic Key Derivation:** Verified scrypt hashing with unique random salt and constant-time equality verification.
5. **Multi-Account Isolation:** Validated that User A and User B cannot query or manipulate each other's records.
6. **OTP Expiry & Attempt Lockout:** Validated rejection on incorrect codes, decremented attempt counters, expiration rejection, and single-use replay protection.
7. **Direct Registration & Multi-Identifier Login:** Validated immediate registration without OTP and verified login using username, email, or mobile number.
8. **Savings Vault PIN Security:** Verified independent PIN hashing, session unlocking, and auto-lock behavior.
9. **Mathematical Ledger Testing:** Verified zero double-counting on savings deposits/withdrawals.
10. **Category Percentage Sum Testing:** Proved $\sum P_i = 100\%$.
11. **Chronological Monthly Trends:** Verified chronological ordering and correct net margin calculations.
12. **Day-of-Week Mapping:** Verified all 7 days sum to exact total expenses.
13. **EDA Heuristics:** Verified outlier detection and weekend surge flag triggering without hallucinated data.
14. **Foreign Key Enforcement:** Verified SQLite strict foreign key cascade constraints and WAL mode persistence.

**Result:** 16/16 test suites passed (0 failures).

---

### 5. LIMITATIONS & FUTURE SCOPE

#### Current Limitations
- External email delivery (for password recovery) requires SMTP or API keys in `.env` (clear configuration error displayed if omitted).
- External SMS delivery requires Twilio credentials in `.env` (clear configuration error displayed if omitted).
- Currency format defaults to USD ($).

#### Future Scope
- Integration with Open Banking APIs (Account Aggregator framework) for automated bank statement synchronization.
- Deployment of a supervised clustering model (K-Means / DBSCAN) on spending frequencies.
- Multi-currency conversion via real-time exchange rate feeds.

