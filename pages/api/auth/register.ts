import type { NextApiRequest, NextApiResponse } from "next";
import { setupDb } from "../../../lib/db";
import { AuthRepository } from "../../../lib/services/AuthRepository";
import { AuthService } from "../../../lib/services/AuthService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });

  try {
    await setupDb();
    const authSvc = new AuthService(new AuthRepository());
    const result = await authSvc.register(name, email, password);
    if (!result.ok) return res.status(400).json({ error: result.error });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[register]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
