import { ILeetCodeClient } from "./LeetCodeClient";
import { SolveRepository } from "./SolveRepository";
import { MEMBERS } from "@/students_list";

export interface SyncResult {
  username: string;
  todayCount: number;
  totalSolved: number;        // ← new field
  backfilledDates: string[];
  status: "ok" | "error";
  error?: string;
}

export class SyncService {
  constructor(
    private readonly leetcode: ILeetCodeClient,
    private readonly repo: SolveRepository
  ) {}

  async syncMember(username: string, todayStr: string): Promise<SyncResult> {
    try {
      // Fetch submissions + total solved count in parallel
      const [byDay, totalSolved] = await Promise.all([
        this.leetcode.fetchSubmissionsByDay(username),
        this.leetcode.fetchTotalSolved(username),
      ]);

      const todayCount = byDay[todayStr] ?? 0;
      const backfilledDates: string[] = [];

      // Always upsert today
      await this.repo.upsert(username, todayStr, todayCount, false);

      // Store total solved count
      await this.repo.upsertTotalSolved(username, totalSolved);

      // Batch backfill historical dates
      const historicalDates = Object.keys(byDay).filter((d) => d !== todayStr);
      if (historicalDates.length > 0) {
        const existing = await this.repo.getExistingDates(username, historicalDates);
        const missing = historicalDates.filter((d) => !existing.has(d));
        await Promise.all(
          missing.map((date) => this.repo.upsert(username, date, byDay[date], true))
        );
        backfilledDates.push(...missing);
      }

      return { username, todayCount, totalSolved, backfilledDates, status: "ok" };
    } catch (e) {
      return {
        username,
        todayCount: 0,
        totalSolved: 0,
        backfilledDates: [],
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async syncAll(todayStr: string): Promise<SyncResult[]> {
    const BATCH_SIZE = 10;
    const results: SyncResult[] = [];
    for (let i = 0; i < MEMBERS.length; i += BATCH_SIZE) {
      const batch = MEMBERS.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((username) => this.syncMember(username, todayStr))
      );
      results.push(...batchResults);
    }
    return results;
  }
}