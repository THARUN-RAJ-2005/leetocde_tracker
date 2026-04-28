import { Pool, QueryResult } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SUPABASE_DATABASE_URL || "",
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function dbQuery(text: string, params?: unknown[]): Promise<QueryResult> {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function setupDb(): Promise<void> {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS daily_solves (
      username      TEXT      NOT NULL,
      date          DATE      NOT NULL,
      solve_count   INTEGER   NOT NULL DEFAULT 0,
      backfilled    BOOLEAN   NOT NULL DEFAULT FALSE,
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (username, date)
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_daily_solves_date ON daily_solves (date);`);
  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_daily_solves_username ON daily_solves (username);`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS user_totals (
      username        TEXT      NOT NULL PRIMARY KEY,
      total_solved    INTEGER   NOT NULL DEFAULT 0,
      easy_solved     INTEGER   NOT NULL DEFAULT 0,
      medium_solved   INTEGER   NOT NULL DEFAULT 0,
      hard_solved     INTEGER   NOT NULL DEFAULT 0,
      acceptance_rate NUMERIC(5,2) DEFAULT 0,
      ranking         INTEGER   DEFAULT 0,
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await dbQuery(`ALTER TABLE user_totals ADD COLUMN IF NOT EXISTS easy_solved INTEGER NOT NULL DEFAULT 0;`);
  await dbQuery(`ALTER TABLE user_totals ADD COLUMN IF NOT EXISTS medium_solved INTEGER NOT NULL DEFAULT 0;`);
  await dbQuery(`ALTER TABLE user_totals ADD COLUMN IF NOT EXISTS hard_solved INTEGER NOT NULL DEFAULT 0;`);
  await dbQuery(`ALTER TABLE user_totals ADD COLUMN IF NOT EXISTS acceptance_rate NUMERIC(5,2) DEFAULT 0;`);
  await dbQuery(`ALTER TABLE user_totals ADD COLUMN IF NOT EXISTS ranking INTEGER DEFAULT 0;`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS user_topic_stats (
      username      TEXT      NOT NULL,
      topic_name    TEXT      NOT NULL,
      problem_count INTEGER   NOT NULL DEFAULT 0,
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (username, topic_name)
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id            SERIAL    PRIMARY KEY,
      email         TEXT      NOT NULL UNIQUE,
      name          TEXT,
      password_hash TEXT,
      is_admin      BOOLEAN   NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await dbQuery(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS name TEXT;`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id           SERIAL    PRIMARY KEY,
      email        TEXT      NOT NULL,
      logged_in_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address   TEXT
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_login_logs_email ON login_logs (email);`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS today_problems (
      id               SERIAL    PRIMARY KEY,
      username         TEXT      NOT NULL,
      date             DATE      NOT NULL,
      title            TEXT      NOT NULL,
      title_slug       TEXT      NOT NULL,
      difficulty       TEXT,
      solved_at        TIMESTAMP,
      submission_count INTEGER   DEFAULT 1,
      updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(username, date, title_slug)
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_today_problems_user_date ON today_problems (username, date);`);
}
