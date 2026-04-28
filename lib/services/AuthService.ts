import bcrypt from "bcryptjs";
import { AuthRepository } from "./AuthRepository";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL as string;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD as string;

export interface LoginResult {
  ok: boolean;
  isAdmin: boolean;
  error?: string;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async ensureAdminExists(): Promise<void> {
    const existing = await this.repo.findByEmail(ADMIN_EMAIL);
    if (!existing) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await this.repo.createAdmin(ADMIN_EMAIL, hash);
    }
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const normalised = email.toLowerCase().trim();
    const user = await this.repo.findByEmail(normalised);

    if (!user) {
      return {
        ok: false,
        isAdmin: false,
        error: "No account found with this email. Please register first.",
      };
    }

    if (user.is_admin) {
      if (!user.password_hash) return { ok: false, isAdmin: false, error: "Admin not configured." };
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return { ok: false, isAdmin: false, error: "Invalid credentials." };
      return { ok: true, isAdmin: true };
    }

    if (user.password_hash) {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return { ok: false, isAdmin: false, error: "Invalid credentials." };
    }

    return { ok: true, isAdmin: false };
  }

  async register(name: string, email: string, password: string): Promise<RegisterResult> {
    const normalised = email.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalised)) {
      return { ok: false, error: "Invalid email address." };
    }

    if (name.trim().length < 2) {
      return { ok: false, error: "Name must be at least 2 characters." };
    }

    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }

    const hash = await bcrypt.hash(password, 12);
    return this.repo.register(name.trim(), normalised, hash);
  }

  async getWhitelistedUsers() {
    return this.repo.getAllWhitelisted();
  }

  async addWhitelistedUser(email: string): Promise<void> {
    await this.repo.addWhitelistedUser(email.toLowerCase().trim());
  }

  async removeWhitelistedUser(id: number): Promise<void> {
    await this.repo.removeUser(id);
  }
}
