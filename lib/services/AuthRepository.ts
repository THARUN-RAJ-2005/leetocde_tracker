import { dbQuery } from "../db";

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  password_hash: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface WhitelistedUser {
  id: number;
  name: string | null;
  email: string;
  created_at: string;
}

export interface LoginLog {
  id: number;
  email: string;
  logged_in_at: string;
  ip_address: string;
}

export class AuthRepository {
  async findByEmail(email: string): Promise<AuthUser | null> {
    const res = await dbQuery(
      `SELECT id, name, email, password_hash, is_admin, created_at
       FROM auth_users WHERE email = $1 LIMIT 1;`,
      [email.toLowerCase()]
    );
    return res.rows[0] ?? null;
  }

  async isWhitelisted(email: string): Promise<boolean> {
    const res = await dbQuery(`SELECT 1 FROM auth_users WHERE email = $1 LIMIT 1;`, [
      email.toLowerCase(),
    ]);
    return (res.rowCount ?? 0) > 0;
  }

  async createAdmin(email: string, passwordHash: string): Promise<void> {
    await dbQuery(
      `INSERT INTO auth_users (email, password_hash, is_admin)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (email) DO NOTHING;`,
      [email.toLowerCase(), passwordHash]
    );
  }

  async addWhitelistedUser(email: string): Promise<void> {
    await dbQuery(
      `INSERT INTO auth_users (email, is_admin)
       VALUES ($1, FALSE)
       ON CONFLICT (email) DO NOTHING;`,
      [email.toLowerCase()]
    );
  }

  async removeUser(id: number): Promise<void> {
    await dbQuery(`DELETE FROM auth_users WHERE id = $1 AND is_admin = FALSE;`, [id]);
  }

  // ✅ FIXED
  async getAllWhitelisted(): Promise<WhitelistedUser[]> {
    const res = await dbQuery(
      `SELECT id, name, email, created_at 
       FROM auth_users
       WHERE is_admin = FALSE 
       ORDER BY created_at DESC;`
    );
    return res.rows;
  }

  async register(
    name: string,
    email: string,
    passwordHash: string
  ): Promise<{ ok: boolean; error?: string }> {
    const existing = await this.findByEmail(email);
    if (existing) {
      return { ok: false, error: "An account with this email already exists." };
    }

    await dbQuery(
      `INSERT INTO auth_users (name, email, password_hash, is_admin)
       VALUES ($1, $2, $3, FALSE);`,
      [name.trim(), email.toLowerCase(), passwordHash]
    );

    return { ok: true };
  }

  async logLogin(email: string, ip: string): Promise<void> {
    await dbQuery(`INSERT INTO login_logs (email, ip_address) VALUES ($1, $2);`, [
      email.toLowerCase(),
      ip,
    ]);
  }

  // ✅ FIXED
  async getLoginLogs(): Promise<LoginLog[]> {
    const res = await dbQuery(
      `SELECT id, email, logged_in_at, ip_address
       FROM login_logs
       ORDER BY logged_in_at DESC
       LIMIT 500;`
    );
    return res.rows;
  }
}
