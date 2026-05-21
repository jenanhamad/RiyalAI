"""SQLite database — local dev or production volume."""
import os
import sqlite3
from pathlib import Path

_DATA_ROOT = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent.parent / "data")))
DB_PATH = _DATA_ROOT / "riyalai.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT DEFAULT '',
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            streak INTEGER DEFAULT 0,
            last_log_date TEXT,
            weekly_xp INTEGER DEFAULT 0,
            week_start TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS expenses (
            expense_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            merchant TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            category TEXT DEFAULT 'Other',
            payment_method TEXT DEFAULT 'Credit Card',
            description TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            status TEXT DEFAULT 'processed',
            has_receipt INTEGER DEFAULT 0,
            is_recurring INTEGER DEFAULT 0,
            receipt_key TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );

        CREATE TABLE IF NOT EXISTS challenges (
            challenge_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            target_reduction_percent REAL DEFAULT 20,
            baseline_amount REAL DEFAULT 0,
            xp_reward INTEGER DEFAULT 150,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
        CREATE INDEX IF NOT EXISTS idx_challenges_user ON challenges(user_id);
    """)
    conn.commit()
    conn.close()
