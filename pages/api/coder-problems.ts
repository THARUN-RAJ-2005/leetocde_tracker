/**
 * GET /api/coder-problems?username=xxx
 * Returns last 5 solved problems with difficulty + submission count
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session";
import { LeetCodeClient } from "../../lib/services/LeetCodeClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ error: "Unauthorized" });

  const username = req.query.username as string;
  if (!username) return res.status(400).json({ error: "username required" });

  try {
    const client = new LeetCodeClient();
    const problems = await client.fetchRecentSolvedProblems(username);
    return res.status(200).json({ problems });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
}