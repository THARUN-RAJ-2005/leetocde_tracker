/**
 * GET /api/admin/login-logs
 * Admin only: returns login history from login_logs table
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../../lib/session";
import { setupDb } from "../../../lib/db";
import { AuthRepository } from "../../../lib/services/AuthRepository";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.user?.isAdmin) return res.status(403).json({ error: "Forbidden" });

  try {
    await setupDb();
    const repo = new AuthRepository();
    const logs = await repo.getLoginLogs();
    return res.status(200).json({ logs });
  } catch (err) {
    console.error("[login-logs]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}