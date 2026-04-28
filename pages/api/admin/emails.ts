/**
 * /api/admin/emails — Microservice: Whitelist Management (admin only)
 * GET    → list all whitelisted emails
 * POST   → add an email
 * DELETE → remove by id
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../../lib/session";
import { setupDb } from "../../../lib/db";
import { AuthRepository } from "../../../lib/services/AuthRepository";
import { AuthService } from "../../../lib/services/AuthService";

async function guard(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.user?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await guard(req, res))) return;
  await setupDb();
  const svc = new AuthService(new AuthRepository());

  if (req.method === "GET") {
    const emails = await svc.getWhitelistedUsers();
    return res.status(200).json({ emails });
  }

  if (req.method === "POST") {
    const { email } = req.body as { email?: string };
    if (!email?.includes("@")) return res.status(400).json({ error: "Valid email required." });
    await svc.addWhitelistedUser(email.trim());
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.body as { id?: number };
    if (!id) return res.status(400).json({ error: "ID required." });
    await svc.removeWhitelistedUser(id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
