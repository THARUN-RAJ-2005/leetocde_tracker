import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session";
import { LeetCodeClient } from "../../lib/services/LeetCodeClient";
import { dbQuery, setupDb } from "../../lib/db";
import { toDateStr } from "../../lib/services/DateUtils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ error: "Unauthorized" });

  const username = req.query.username as string;
  if (!username) return res.status(400).json({ error: "username required" });

  const dateStr = toDateStr(new Date());

  try {
    await setupDb();

    // Check cache first
    const cached = await dbQuery(
      `SELECT title, title_slug, difficulty, solved_at, submission_count
       FROM today_problems WHERE username=$1 AND date=$2;`,
      [username, dateStr]
    );

    if (cached.rows.length > 0) {
      return res.status(200).json({ problems: cached.rows.map(r => ({
        title: r.title, titleSlug: r.title_slug, difficulty: r.difficulty,
        solvedAt: r.solved_at, submissionCount: r.submission_count, lang: "",
      })), cached: true });
    }

    const client = new LeetCodeClient();
    const problems = await client.fetchTodayProblems(username, dateStr);

    // Cache results
    for (const p of problems) {
      await dbQuery(
        `INSERT INTO today_problems (username, date, title, title_slug, difficulty, solved_at, submission_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (username, date, title_slug) DO UPDATE SET
           difficulty=EXCLUDED.difficulty, solved_at=EXCLUDED.solved_at,
           submission_count=EXCLUDED.submission_count, updated_at=NOW();`,
        [username, dateStr, p.title, p.titleSlug, p.difficulty, p.solvedAt, p.submissionCount]
      );
    }

    return res.status(200).json({ problems, cached: false });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
}
