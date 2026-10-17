# Financial Data Preservation & Backup Guide

This document describes how existing financial records and user accounts are permanently preserved, isolated, and backed up in the **Personal Expense Pattern Analyzer**.

---

## 1. Permanent SQLite Database Architecture

- **Database Location:** `./data/expense_analyzer.db`
- **Journal Mode:** Write-Ahead Logging (`PRAGMA journal_mode = WAL;`)
- **Foreign Keys:** Strictly enabled (`PRAGMA foreign_keys = ON;`)

Unlike transient browser caches or single-browser localStorage, the database is stored as a persistent file on the server. When the application server restarts or reloads, the SQLite database remains completely intact.

---

## 2. Safe Schema Updates & Migrations

The database initialization script uses safe DDL operations:
```sql
CREATE TABLE IF NOT EXISTS users (...);
CREATE TABLE IF NOT EXISTS transactions (...);
CREATE TABLE IF NOT EXISTS savings_transactions (...);
CREATE TABLE IF NOT EXISTS sessions (...);
CREATE TABLE IF NOT EXISTS otps (...);
```
- No table is ever dropped (`DROP TABLE` is strictly prohibited).
- Existing records are never wiped or reset during schema checks.
- Each user's data is isolated by their unique `user_id` foreign key.

---

## 3. Account-Level Data Export and Import (JSON)

### How to Export Your Data:
1. Log in to your account.
2. Navigate to **Account & Recovery** in the left sidebar.
3. Scroll to **Data Preservation, Backups & Sample Dataset**.
4. Click **Export JSON File**.
5. A JSON file containing your user metadata, all transactions, and all savings entries will be downloaded to your computer:
   `expense_analyzer_<username>_backup.json`

### How to Restore or Import Data:
1. Under **Import Data (JSON)**, click **Select File to Import**.
2. Choose your previously saved `.json` file.
3. The server validates the format and safely imports or updates the transactions using `INSERT OR REPLACE INTO transactions`, matching stable UUIDs without duplicate row generation.

---

## 4. Physical SQLite Database Backups

To create a full physical binary snapshot of the entire multi-user database:

### Method A: From the In-App Interface
1. In **Account & Recovery**, click **Create DB Snapshot**.
2. The server executes `PRAGMA wal_checkpoint(TRUNCATE);` to ensure all in-memory WAL log transactions are flushed into the main database file, and creates a timestamped copy:
   `./data/expense_analyzer_backup_YYYY-MM-DDTHH-MM-SS.db`

### Method B: Manual File System Backup
1. Stop the application server (`Ctrl + C`).
2. Copy the `./data/expense_analyzer.db` file to a safe directory or cloud drive:
   ```bash
   cp ./data/expense_analyzer.db ./data/expense_analyzer_manual_backup.db
   ```
3. To restore on a new machine, simply place this file back into `./data/expense_analyzer.db`.

---

## 5. Sample Data Isolation

If you use the **Student Laboratory Sample Dataset**:
- All sample records are flagged with `is_sample = 1`.
- Clicking **Remove Sample** runs `DELETE FROM transactions WHERE user_id = ? AND is_sample = 1`.
- Your real, personal expenses (`is_sample = 0`) are completely unaffected and preserved.
