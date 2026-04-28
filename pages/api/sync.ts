import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session";
import { setupDb } from "../../lib/db";
import { SolveRepository } from "../../lib/services/SolveRepository";
import { LeetCodeClient } from "../../lib/services/LeetCodeClient";
import { SyncService } from "../../lib/services/SyncService";
import { LeaderboardService } from "../../lib/services/LeaderboardService";
import { getWeekBounds, getMonthBounds, toDateStr } from "../../lib/services/DateUtils";
import { MEMBERS } from "@/students_list";

// Auto-refresh: track last full sync time in memory
let lastFullSync: number = 0;
const FULL_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    await setupDb();
    const now = new Date();
    const todayStr = toDateStr(now);
    const { start: weekStart, end: weekEnd } = getWeekBounds(now);
    const { start: monthStart, end: monthEnd } = getMonthBounds(now);

    const repo = new SolveRepository();
    const leetcode = new LeetCodeClient();
    const syncSvc = new SyncService(leetcode, repo);
    const boardSvc = new LeaderboardService(repo);

    const isBackground = req.query.background === "1";
    const forceRefresh = req.query.force === "1";
    const nowMs = Date.now();

    // Auto-refresh logic: if 10 minutes have passed since last full sync, trigger one
    const shouldAutoSync = (nowMs - lastFullSync) > FULL_SYNC_INTERVAL_MS;

    if (isBackground && !forceRefresh) {
      // Return cached data immediately
      const { todayBoard, weeklyBoard, monthlyBoard, overallBoard, dailyBreakdown } =
        await boardSvc.getAll(todayStr, weekStart, weekEnd, monthStart, monthEnd);

      res.status(200).json({
        todayStr, weekStart, weekEnd, monthStart, monthEnd,
        members: MEMBERS, syncResults: [],
        syncing: shouldAutoSync,
        lastSyncMs: lastFullSync,
        todayLeaderboard: todayBoard,
        weeklyLeaderboard: weeklyBoard,
        monthlyLeaderboard: monthlyBoard,
        overallLeaderboard: overallBoard,
        dailyBreakdown,
      });

      // Kick off sync in background if due
      if (shouldAutoSync) {
        syncSvc.syncAll(todayStr).then(() => { lastFullSync = Date.now(); })
          .catch((e) => console.error("[bg-sync]", e));
      }
      return;
    }

    // Full sync
    const syncResults = await syncSvc.syncAll(todayStr);
    lastFullSync = Date.now();

    const { todayBoard, weeklyBoard, monthlyBoard, overallBoard, dailyBreakdown } =
      await boardSvc.getAll(todayStr, weekStart, weekEnd, monthStart, monthEnd);

    return res.status(200).json({
      todayStr, weekStart, weekEnd, monthStart, monthEnd,
      members: MEMBERS, syncResults, syncing: false, lastSyncMs: lastFullSync,
      todayLeaderboard: todayBoard,
      weeklyLeaderboard: weeklyBoard,
      monthlyLeaderboard: monthlyBoard,
      overallLeaderboard: overallBoard,
      dailyBreakdown,
    });
  } catch (err) {
    console.error("[sync]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
}
