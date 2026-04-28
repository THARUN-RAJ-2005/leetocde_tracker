import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../../lib/session";
import { dbQuery, setupDb } from "../../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.user?.isAdmin) return res.status(403).json({ error: "Forbidden" });

  const usernames = (req.query.users as string)?.split(",").filter(Boolean) ?? [];
  if (usernames.length < 1) return res.status(400).json({ error: "At least 1 user required" });

  try {
    await setupDb();

    // Totals
    const totals = await dbQuery(
      `SELECT username, total_solved, easy_solved, medium_solved, hard_solved, acceptance_rate, ranking
       FROM user_totals WHERE username = ANY($1);`,
      [usernames]
    );

    // Daily activity last 60 days
    const activity = await dbQuery(
      `SELECT username, date::text, solve_count FROM daily_solves
       WHERE username = ANY($1) AND date >= NOW() - INTERVAL '60 days'
       ORDER BY date ASC;`,
      [usernames]
    );

    // Topic stats
    const topics = await dbQuery(
      `SELECT username, topic_name, problem_count FROM user_topic_stats
       WHERE username = ANY($1) ORDER BY problem_count DESC;`,
      [usernames]
    );

    // Weekly trend (last 8 weeks)
    const weeklyTrend = await dbQuery(
      `SELECT username,
              DATE_TRUNC('week', date)::date::text AS week_start,
              SUM(solve_count)::int AS weekly_total
       FROM daily_solves
       WHERE username = ANY($1) AND date >= NOW() - INTERVAL '8 weeks'
       GROUP BY username, DATE_TRUNC('week', date)
       ORDER BY week_start ASC;`,
      [usernames]
    );

    // Monthly trend
    const monthlyTrend = await dbQuery(
      `SELECT username,
              TO_CHAR(date, 'YYYY-MM') AS month,
              SUM(solve_count)::int AS monthly_total
       FROM daily_solves
       WHERE username = ANY($1) AND date >= NOW() - INTERVAL '6 months'
       GROUP BY username, TO_CHAR(date, 'YYYY-MM')
       ORDER BY month ASC;`,
      [usernames]
    );

    // Rankings within group
    const groupRanking = await dbQuery(
      `SELECT username, COALESCE(SUM(solve_count),0)::int AS total
       FROM daily_solves WHERE username = ANY($1)
       GROUP BY username ORDER BY total DESC;`,
      [usernames]
    );

    return res.status(200).json({
      totals: totals.rows,
      activity: activity.rows,
      topics: topics.rows,
      weeklyTrend: weeklyTrend.rows,
      monthlyTrend: monthlyTrend.rows,
      groupRanking: groupRanking.rows,
    });
  } catch (err) {
    console.error("[analytics]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
