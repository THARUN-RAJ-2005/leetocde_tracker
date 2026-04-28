import { SolveRepository, LeaderboardEntry, WeeklyEntry, DailyBreakdownRow } from "./SolveRepository";
import { MEMBERS } from "@/students_list";

export interface FullLeaderboard {
  todayBoard: LeaderboardEntry[];
  weeklyBoard: WeeklyEntry[];
  monthlyBoard: WeeklyEntry[];
  overallBoard: WeeklyEntry[];
  dailyBreakdown: DailyBreakdownRow[];
}

export class LeaderboardService {
  constructor(private readonly repo: SolveRepository) {}

  async getAll(
    todayStr: string,
    weekStart: string,
    weekEnd: string,
    monthStart: string,
    monthEnd: string
  ): Promise<FullLeaderboard> {
    const [todayRaw, weeklyRaw, monthlyRaw, overallRaw, dailyBreakdown] = await Promise.all([
      this.repo.getTodayBoard(todayStr),
      this.repo.getWeeklyBoard(weekStart, weekEnd),
      this.repo.getMonthlyBoard(monthStart, monthEnd),
      this.repo.getOverallBoard(),
      this.repo.getDailyBreakdown(weekStart, weekEnd),
    ]);

    const todayMap = new Map(todayRaw.map((r) => [r.username, r.solve_count]));
    const todayBoard: LeaderboardEntry[] = MEMBERS
      .map((u) => ({ username: u, solve_count: todayMap.get(u) ?? 0 }))
      .sort((a, b) => b.solve_count - a.solve_count);

    const weekMap = new Map(weeklyRaw.map((r) => [r.username, r.total_solves]));
    const weeklyBoard: WeeklyEntry[] = MEMBERS
      .map((u) => ({ username: u, total_solves: weekMap.get(u) ?? 0 }))
      .sort((a, b) => b.total_solves - a.total_solves);

    const monthMap = new Map(monthlyRaw.map((r) => [r.username, r.total_solves]));
    const monthlyBoard: WeeklyEntry[] = MEMBERS
      .map((u) => ({ username: u, total_solves: monthMap.get(u) ?? 0 }))
      .sort((a, b) => b.total_solves - a.total_solves);

    const overallMap = new Map(overallRaw.map((r) => [r.username, r.total_solves]));
    const overallBoard: WeeklyEntry[] = MEMBERS
      .map((u) => ({ username: u, total_solves: overallMap.get(u) ?? 0 }))
      .sort((a, b) => b.total_solves - a.total_solves);

    return { todayBoard, weeklyBoard, monthlyBoard, overallBoard, dailyBreakdown };
  }
}