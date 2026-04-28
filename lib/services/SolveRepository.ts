/**
 * SolveRepository — Single Responsibility: all DB reads/writes for daily_solves table.
 * Open/Closed: new query methods can be added without touching existing ones.
 */
import { dbQuery } from "../db";

export interface DailySolveRow {
  username: string;
  date: string;
  solve_count: number;
  backfilled: boolean;
}

export interface LeaderboardEntry {
  username: string;
  solve_count: number;
}

export interface WeeklyEntry {
  username: string;
  total_solves: number;
}

export interface DailyBreakdownRow {
  username: string;
  date: string;
  solve_count: number;
}

export class SolveRepository {
  /** Upsert a single username+date solve count */
  async upsert(username: string, date: string, count: number, backfilled = false): Promise<void> {
    await dbQuery(
      `INSERT INTO daily_solves (username, date, solve_count, backfilled, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (username, date)
       DO UPDATE SET
         solve_count = EXCLUDED.solve_count,
         backfilled  = EXCLUDED.backfilled,
         updated_at  = NOW();`,
      [username, date, count, backfilled]
    );
  }

  /** Check which dates in a list already exist for a username */
  async getExistingDates(username: string, dates: string[]): Promise<Set<string>> {
    if (dates.length === 0) return new Set();
    const res = await dbQuery(
      `SELECT date::text FROM daily_solves WHERE username = $1 AND date = ANY($2::date[]);`,
      [username, dates]
    );
    return new Set(res.rows.map((r) => r.date));
  }

  /** Today's leaderboard for a specific date */
  async getTodayBoard(date: string): Promise<LeaderboardEntry[]> {
    const res = await dbQuery(
      `SELECT username, solve_count
       FROM daily_solves
       WHERE date = $1
       ORDER BY solve_count DESC;`,
      [date]
    );
    return res.rows;
  }

  /** Weekly totals between two dates */
  async getWeeklyBoard(startDate: string, endDate: string): Promise<WeeklyEntry[]> {
    const res = await dbQuery(
      `SELECT username, COALESCE(SUM(solve_count), 0)::int AS total_solves
       FROM daily_solves
       WHERE date >= $1 AND date <= $2
       GROUP BY username
       ORDER BY total_solves DESC;`,
      [startDate, endDate]
    );
    return res.rows;
  }

  /** Full daily breakdown for the history matrix */
  async getDailyBreakdown(startDate: string, endDate: string): Promise<DailyBreakdownRow[]> {
    const res = await dbQuery(
      `SELECT username, date::text, solve_count
       FROM daily_solves
       WHERE date >= $1 AND date <= $2
       ORDER BY date ASC, solve_count DESC;`,
      [startDate, endDate]
    );
    return res.rows;
  }

  /** Monthly totals between two dates */
  async getMonthlyBoard(startDate: string, endDate: string): Promise<WeeklyEntry[]> {
    const res = await dbQuery(
      `SELECT username, COALESCE(SUM(solve_count), 0)::int AS total_solves
       FROM daily_solves
       WHERE date >= $1 AND date <= $2
       GROUP BY username
       ORDER BY total_solves DESC;`,
      [startDate, endDate]
    );
    return res.rows;
  }

  /** Upsert all-time total solved count from LeetCode directly */
  async upsertTotalSolved(username: string, total: number): Promise<void> {
    await dbQuery(
      `INSERT INTO user_totals (username, total_solved, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (username)
      DO UPDATE SET total_solved = EXCLUDED.total_solved, updated_at = NOW();`,
      [username, total]
    );
  }

  /** Overall leaderboard — real all-time totals from LeetCode */
  async getOverallBoard(): Promise<WeeklyEntry[]> {
    const res = await dbQuery(
      `SELECT username, total_solved AS total_solves
      FROM user_totals
      ORDER BY total_solved DESC;`
    );
    return res.rows;
  }

  /** Get all dates that have NOT been backfilled for a user within a range */
  async getMissingDates(username: string, startDate: string, endDate: string): Promise<string[]> {
    const res = await dbQuery(
      `SELECT date::text FROM daily_solves
       WHERE username = $1 AND date >= $2 AND date <= $3 AND backfilled = FALSE;`,
      [username, startDate, endDate]
    );
    return res.rows.map((r) => r.date);
  }
}
