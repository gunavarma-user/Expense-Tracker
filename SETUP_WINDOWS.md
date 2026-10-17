# Windows Setup and Execution Guide

This guide provides exact, step-by-step instructions to set up, test, and run the **Personal Expense Pattern Analyzer** on any Windows 10 or Windows 11 machine.

---

## 1. System Requirements
- **Operating System:** Windows 10 or Windows 11 (64-bit)
- **Node.js:** Version 22.x LTS (Recommended: Node 22.14.0 or newer from [nodejs.org](https://nodejs.org))
  - Note: Node 22 includes built-in `node:sqlite` support, requiring no extra native compilers on Windows!
- **Terminal:** PowerShell or Windows Terminal (or Command Prompt)

---

## 2. Step-by-Step Installation

### Step 1: Verify Node.js Installation
Open PowerShell and run:
```powershell
node -v
npm -v
```
You should see `v22.x.x` (or newer) and `npm` version `10.x.x` (or newer).

> [!TIP]
> If PowerShell reports that `node` or `npm` is not recognized, add the Node installation folder to your current session PATH:
> ```powershell
> $env:Path = "C:\Program Files\nodejs;" + $env:Path
> ```

### Step 2: Extract or Clone Project Directory
Navigate to the directory containing the project:
```powershell
cd C:\path\to\personal-expense-pattern-analyzer
```

### Step 3: Install Required Dependencies
Install the required frontend and backend packages:
```powershell
npm install
```

### Step 4: Environment Variables (Optional)
If you want to configure optional email SMTP credentials for "Forgot Password" recovery:
```powershell
Copy-Item .env.example .env
```
*(By default, the application runs out of the box with direct credential-based signup/login without requiring external credentials or paid SMS services).*

---

## 3. Pre-Run Verification & Automated Tests

### 1. TypeScript Static Typecheck
Verify that all source code compiles cleanly without type errors:
```powershell
npm run lint
```

### 2. Run Automated Test Suite (16 Tests)
Run the full security, authentication, EDA pattern, and database integration test suite:
```powershell
npm test
```
All 16 tests will execute and pass with 0 failures.

### 3. Verify Production SPA Build
Compile the client bundle to ensure production packaging is healthy:
```powershell
npm run build
```

---

## 4. Starting the Application

Launch the full-stack development server:
```powershell
npm run dev
```

You will see output similar to:
```
[Expense Pattern Analyzer] Server running on http://0.0.0.0:3000
[Environment] Mode: development
```

Open your web browser (Chrome, Edge, or Firefox) and navigate to:
```
http://localhost:3000
```

---

## 5. Live Demonstration & Evaluation Steps

1. **Account Creation:**
   - Click **Create Account** on the login screen.
   - Enter a username (e.g. `student_alex`) and password (e.g. `Pass1234!`).
   - Optionally enter an email and mobile number.
   - Click **Create Account**.

2. **Load Student Laboratory Sample Dataset:**
   - In the dashboard, click **Load Student Sample Dataset**.
   - 14 realistic college transactions across 2 months are loaded instantly.
   - Inspect the Income vs Expense trends and Category breakdowns.

3. **Explore Pattern Analytics:**
   - Click **Pattern Analytics** in the left sidebar.
   - Review the algorithmic observations (e.g., weekend outlay surge, category dominance, statistical outlier alerts).

4. **Multi-Identifier Login & Rate Limiting:**
   - Log out to return to the sign-in screen.
   - Test logging in using your username, registered email, or mobile number + password.
   - Test rate limiting security: entering an incorrect password 5 consecutive times triggers an automatic 15-minute persistent lockout protecting the account against brute-force attacks.

5. **Password Recovery ("Forgot Password"):**
   - Click **Forgot Password?** on the login screen.
   - Enter your registered email address.
   - When SMTP/email API credentials are configured in `.env`, a 5-minute single-use OTP is securely dispatched.
   - If unconfigured, the application returns a clear, safe configuration message.

6. **Unlock Savings Vault:**
   - Click **Savings Vault** in the sidebar.
   - Set up an initial 4-digit PIN (e.g. `1234`).
   - Deposit $100 from main balance to savings.
   - Observe that the savings balance increases by $100, main balance decreases by $100, and overall expense totals are NOT distorted.
   - Click **Lock** to lock the vault again.

7. **Backup & Data Preservation:**
   - In **Account & Recovery**, click **Export JSON File** to download a portable backup.
   - Click **Create DB Snapshot** to generate a WAL-checkpointed SQLite backup copy in `./data`.
   - Data persists across server reboots, terminal restarts, and browser refreshes in `./data/expense_analyzer.db`.
