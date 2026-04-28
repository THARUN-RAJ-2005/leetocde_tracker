import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session";
import { LeetCodeClient } from "../../lib/services/LeetCodeClient";
import { dbQuery, setupDb } from "../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ error: "Unauthorized" });

  const username = req.query.username as string;
  if (!username) return res.status(400).json({ error: "username required" });

  try {
    await setupDb();
    const client = new LeetCodeClient();
    const profile = await client.fetchUserProfile(username);

    // Cache to DB
    await dbQuery(
      `INSERT INTO user_totals (username, total_solved, easy_solved, medium_solved, hard_solved, acceptance_rate, ranking, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (username) DO UPDATE SET
         total_solved=EXCLUDED.total_solved, easy_solved=EXCLUDED.easy_solved,
         medium_solved=EXCLUDED.medium_solved, hard_solved=EXCLUDED.hard_solved,
         acceptance_rate=EXCLUDED.acceptance_rate, ranking=EXCLUDED.ranking, updated_at=NOW();`,
      [username, profile.totalSolved, profile.easySolved, profile.mediumSolved,
       profile.hardSolved, profile.acceptanceRate, profile.ranking]
    );

    // Cache topic stats
    for (const t of profile.topicStats.slice(0, 30)) {
      await dbQuery(
        `INSERT INTO user_topic_stats (username, topic_name, problem_count, updated_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (username, topic_name) DO UPDATE SET problem_count=EXCLUDED.problem_count, updated_at=NOW();`,
        [username, t.topicName, t.problemsSolved]
      );
    }

    // Get total from DB to show tracker-based total too
    const dbTotal = await dbQuery(
      `SELECT COALESCE(SUM(solve_count),0)::int AS tracked FROM daily_solves WHERE username=$1;`,
      [username]
    );

    // Activity: last 90 days from daily_solves
    const activityRes = await dbQuery(
      `SELECT date::text, solve_count FROM daily_solves
       WHERE username=$1 AND date >= NOW() - INTERVAL '90 days'
       ORDER BY date ASC;`,
      [username]
    );

    return res.status(200).json({
      profile,
      trackedTotal: dbTotal.rows[0]?.tracked ?? 0,
      activity: activityRes.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
}
