import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { MEMBER_DISPLAY } from "@/students_list";

// ── Types ────────────────────────────────────────────────────────────────────
interface RecentProblem {
  title: string;
  titleSlug: string;
  difficulty: string;
  solvedAt: string;
  submissionCount: number;
}

interface CoderModal {
  username: string;
  displayName: string;
  problems: RecentProblem[] | null;
  loading: boolean;
  error: string | null;
}

interface LeaderboardEntry {
  username: string;
  solve_count: number;
}
interface WeeklyEntry {
  username: string;
  total_solves: number;
}
interface DailyBreakdownRow {
  username: string;
  date: string;
  solve_count: number;
}
interface SyncResult {
  username: string;
  todayCount: number;
  backfilledDates: string[];
  status: "ok" | "error";
  error?: string;
}
interface ApiData {
  todayStr: string;
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
  members: string[];
  syncResults: SyncResult[];
  todayLeaderboard: LeaderboardEntry[];
  weeklyLeaderboard: WeeklyEntry[];
  monthlyLeaderboard: WeeklyEntry[];
  overallLeaderboard: WeeklyEntry[];
  dailyBreakdown: DailyBreakdownRow[];
}


// ── Constants ────────────────────────────────────────────────────────────────

const RANK_EMOJIS = ["🥇", "🥈", "🥉"];
const DISPLAY_NAME = MEMBER_DISPLAY;

function displayName(u: string) {
  return DISPLAY_NAME[u] || u;
}

// ── Color scale: red → amber → green based on solve count ───────────────────
// 0 → crimson red, 1→2 → orange-red, 3→4 → amber, 5→7 → yellow-green, 8+ → green

function solveColor(count: number): string {
  if (count === 0) return "#ef4444"; // red
  if (count <= 2) return "#f97316"; // orange
  if (count <= 4) return "#eab308"; // amber
  if (count <= 7) return "#84cc16"; // lime
  return "#22c55e"; // green
}

function solveColorBg(count: number): string {
  if (count === 0) return "rgba(239,68,68,0.08)";
  if (count <= 2) return "rgba(249,115,22,0.08)";
  if (count <= 4) return "rgba(234,179,8,0.08)";
  if (count <= 7) return "rgba(132,204,22,0.08)";
  return "rgba(34,197,94,0.08)";
}

function solveBorder(count: number): string {
  if (count === 0) return "rgba(239,68,68,0.25)";
  if (count <= 2) return "rgba(249,115,22,0.25)";
  if (count <= 4) return "rgba(234,179,8,0.25)";
  if (count <= 7) return "rgba(132,204,22,0.25)";
  return "rgba(34,197,94,0.25)";
}

// Bar gradient: red→green dynamically
function barGradient(count: number, max: number): string {
  const pct = max > 0 ? count / max : 0;
  // Interpolate hue: 0° (red) → 120° (green)
  const hue = Math.round(pct * 120);
  return `hsl(${hue}, 80%, 50%)`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const color = barGradient(value, max);
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function SolveCountBadge({ count }: { count: number }) {
  return (
    <span
      className="solve-badge"
      style={{
        color: solveColor(count),
        background: solveColorBg(count),
        border: `1px solid ${solveBorder(count)}`,
      }}
    >
      {count}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Cell background for history matrix (red→green)
function cellStyle(v: number): React.CSSProperties {
  if (v === 0) return { background: "var(--bg)", color: "var(--border)" };
  return {
    background: solveColorBg(v),
    color: solveColor(v),
    border: `1px solid ${solveBorder(v)}`,
    fontWeight: v >= 5 ? 700 : 400,
  };
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [tab, setTab] = useState<"today" | "week" | "month" | "overall">("today");
  const [monthSearch, setMonthSearch] = useState("");
  const [dots, setDots] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [modal, setModal] = useState<CoderModal | null>(null);

  const [todayModal, setTodayModal] = useState<{
    username: string; displayName: string;
    problems: { title:string; titleSlug:string; difficulty:string; solvedAt:string; submissionCount:number; lang:string }[] | null;
    loading: boolean; error: string | null;
  } | null>(null);


  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(iv);
  }, [loading]);

  async function openCoderModal(username: string) {
    setModal({
      username,
      displayName: displayName(username),
      problems: null,
      loading: true,
      error: null,
    });
    try {
      const res = await fetch(`/api/coder-problems?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setModal((m) => (m ? { ...m, problems: data.problems, loading: false } : null));
    } catch (e) {
      setModal((m) =>
        m ? { ...m, loading: false, error: e instanceof Error ? e.message : "Failed" } : null
      );
    }
  }


  async function openTodayModal(username: string) {
    setTodayModal({ username, displayName: displayName(username), problems: null, loading: true, error: null });
    try {
      const res = await fetch(`/api/today-problems?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTodayModal(m => m ? { ...m, problems: data.problems, loading: false } : null);
    } catch(e) {
      setTodayModal(m => m ? { ...m, loading: false, error: e instanceof Error ? e.message : "Failed" } : null);
    }
  }

  const refresh = useCallback(
    async (background = false) => {
      setLoading(true);
      setError(null);
      try {
        const url = background ? "/api/sync?background=1" : "/api/sync";
        const res = await fetch(url);
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const json: ApiData = await res.json();
        setData(json);
        setLastRefresh(
          new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  // async function openCoderModal(username: string) {
  //   setModal({
  //     username,
  //     displayName: displayName(username),
  //     problems: null,
  //     loading: true,
  //     error: null,
  //   });
  //   try {
  //     const res = await fetch(`/api/coder-problems?username=${encodeURIComponent(username)}`);
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data.error || "Failed");
  //     setModal((m) => (m ? { ...m, problems: data.problems, loading: false } : null));
  //   } catch (e) {
  //     setModal((m) =>
  //       m ? { ...m, loading: false, error: e instanceof Error ? e.message : "Failed" } : null
  //     );
  //   }
  // }

  function downloadCSV(rows: WeeklyEntry[], monthStart: string, monthEnd: string) {
    const header = ["Rank", "Name", "Username", "Problems Solved"].join(",");
    const lines = rows.map((u, i) =>
      [i + 1, `"${displayName(u.username)}"`, u.username, u.total_solves].join(",")
    );
    const csv = [`Monthly Report: ${monthStart} to ${monthEnd}`, header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-report-${monthStart}-to-${monthEnd}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function downloadPDF(rows: WeeklyEntry[], monthStart: string, monthEnd: string) {
    const win = window.open("", "_blank");
    if (!win) return;

    const diffColor = (i: number) =>
      i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#c2845f" : "#6b7280";

    const rowsHtml = rows
      .map(
        (u, i) => `
    <tr>
      <td style="color:${diffColor(i)};font-weight:700;text-align:center">${
          i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`
        }</td>
      <td>${displayName(u.username)}</td>
      <td style="color:#6b7280;font-size:11px">${u.username}</td>
      <td style="text-align:center;font-weight:700;color:#00e5a0;font-size:16px">${
        u.total_solves
      }</td>
    </tr>
  `
      )
      .join("");

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Monthly Report — ${monthStart} to ${monthEnd}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #0a0c0f; color: #e2e8f0; padding: 2rem; margin: 0; }
    h1 { font-size: 20px; color: #00e5a0; margin-bottom: 4px; }
    p  { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; letter-spacing: 0.1em; color: #6b7280; border-bottom: 1px solid #2a2d35; padding: 8px 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #191c22; font-size: 13px; }
    tr:hover td { background: #111318; }
    @media print {
      body { background: #fff; color: #000; }
      h1 { color: #000; }
      td, th { border-color: #ccc; color: #000; }
      td[style] { color: #000 !important; }
    }
  </style>
</head>
<body>
  <h1>[LC] Monthly Leaderboard</h1>
  <p>Period: ${monthStart} → ${monthEnd} &nbsp;·&nbsp; ${rows.length} coders</p>
  <table>
    <thead><tr><th>RANK</th><th>NAME</th><th>USERNAME</th><th>SOLVED</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload=()=>{window.print();}<\/script>
</body>
</html>`);
    win.document.close();
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.loggedIn) {
          router.replace("/login");
          return;
        }
        setAuthChecked(true);
        setIsAdmin(d.user?.isAdmin || false);
        refresh(true); // fast load: show stale data immediately, sync in background;
      })
      .catch(() => router.replace("/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-refresh every 10 minutes + on page visibility change ────────────
  useEffect(() => {
    const interval = setInterval(() => {
      refresh(true); // background refresh
    }, 10 * 60 * 1000);

    const handleVisibility = () => {
      if (!document.hidden) refresh(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────

  const todayMax = Math.max(1, ...(data?.todayLeaderboard.map((u) => u.solve_count) ?? [0]));
  const weekMax = Math.max(1, ...(data?.weeklyLeaderboard.map((u) => u.total_solves) ?? [0]));
  const monthMax = Math.max(1, ...(data?.monthlyLeaderboard.map((u) => u.total_solves) ?? [0]));
  const overallMax = Math.max(1, ...(data?.overallLeaderboard.map((u) => u.total_solves) ?? [0]));

  // Filtered monthly rows — reacts to search input
  const filteredMonthly = (data?.monthlyLeaderboard ?? []).filter(
    (u) =>
      displayName(u.username).toLowerCase().includes(monthSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(monthSearch.toLowerCase())
  );

  // Count backfilled dates from sync
  const totalBackfilled =
    data?.syncResults.reduce((s, r) => s + (r.backfilledDates?.length ?? 0), 0) ?? 0;

  // ── Auth loading ─────────────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0a0c0f",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid #2a2d35",
            borderTopColor: "#00e5a0",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>LeetCode Progress Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="root">
        <div className="scanlines" />

        {/* ── Header ── */}
        <header className="header">
          <div className="header-left">
            <span className="logo-bracket">[</span>
            <span className="logo-text">LC</span>
            <span className="logo-bracket">]</span>
            <span className="title">Progress Tracker</span>
          </div>
          <div className="header-right">
            {lastRefresh && <span className="last-refresh">UPDATED {lastRefresh}</span>}
            <button
              className={`refresh-btn ${loading ? "loading" : ""}`}
              onClick={() => refresh()}
              disabled={loading}
            >
              {loading ? `SYNCING${dots}` : "↻ REFRESH"}
            </button>
            {isAdmin && (
              <button className="admin-btn" onClick={() => router.push("/admin")}>
                ⚙ ADMIN
              </button>
            )}
            <button
              className="logout-btn"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.replace("/login");
              }}
            >
              LOGOUT
            </button>
          </div>
        </header>

        {error && <div className="error-bar">⚠ {error}</div>}

        {/* ── Initial loading ── */}
        {loading && !data && (
          <div className="loading-screen">
            <div className="loading-inner">
              <div className="spinner" />
              <p>Fetching from LeetCode{dots}</p>
              <p className="loading-sub">
                Syncing today . This stays between us 🤫 I expect this to be handled properly{" "}
              </p>
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        {data && (
          <main className="main">
            {/* Date badge */}
            <div className="date-badge">
              <span className="date-label">TODAY</span>
              <span className="date-val">{formatDate(data.todayStr)}</span>
              <span className="date-sep">·</span>
              <span className="date-label">WEEK</span>
              <span className="date-val">
                {formatDate(data.weekStart)} → {formatDate(data.weekEnd)}
              </span>
              <span className="date-sep">·</span>
              <span className="date-label">MONTH</span>
              <span className="date-val">
                {formatDate(data.monthStart)} → {formatDate(data.monthEnd)}
              </span>
              {totalBackfilled > 0 && (
                <>
                  <span className="date-sep">·</span>
                  <span className="backfill-badge">↺ {totalBackfilled} dates backfilled</span>
                </>
              )}
            </div>

            {/* Color legend */}
            <div className="legend">
              <span className="legend-label">PROGRESS SCALE</span>
              {[
                { label: "0", count: 0 },
                { label: "1–2", count: 1 },
                { label: "3–4", count: 3 },
                { label: "5–7", count: 5 },
                { label: "8+", count: 8 },
              ].map(({ label, count }) => (
                <span
                  key={label}
                  className="legend-pill"
                  style={{
                    color: solveColor(count),
                    background: solveColorBg(count),
                    border: `1px solid ${solveBorder(count)}`,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Tabs */}
            <div className="tabs">
              {(["today", "week", "month", "overall"] as const).map((t) => (
                <button
                  key={t}
                  className={`tab ${tab === t ? "tab-active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t === "today"
                    ? "TODAY'S BOARD"
                    : t === "week"
                    ? "WEEKLY BOARD"
                    : t === "month"
                    ? "MONTHLY BOARD"
                    : "OVERALL BOARD"}
                </button>
              ))}
            </div>

            {/* ── TODAY ── */}
            {tab === "today" && (
              <section className="board">
                <div className="board-header">
                  <span>RANK</span>
                  <span>CODER</span>
                  <span>SOLVED TODAY</span>
                  <span>PROGRESS</span>
                </div>
                {data.todayLeaderboard.map((u, i) => (
                  <div
                    key={u.username}
                    className={`board-row ${
                      i === 0 ? "row-gold" : i === 1 ? "row-silver" : i === 2 ? "row-bronze" : ""
                    }`}
                  >
                    <span className="rank">{i < 3 ? RANK_EMOJIS[i] : `#${i + 1}`}</span>
                    <span className="username-col" onClick={() => openTodayModal(u.username)} style={{cursor:"pointer"}}>
                      <span className="username-short username-link">{displayName(u.username)}</span>
                      <span className="username-lc">{u.username}</span>
                    </span>
                    <span className="count-col">
                      <SolveCountBadge count={u.solve_count} />
                      <span className="count-label">problems</span>
                    </span>
                    <span className="bar-col">
                      <ProgressBar value={u.solve_count} max={todayMax} />
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* ── WEEK ── */}
            {tab === "week" && (
              <section className="board">
                <div className="board-header">
                  <span>RANK</span>
                  <span>CODER</span>
                  <span>WEEKLY TOTAL</span>
                  <span>PROGRESS</span>
                </div>
                {data.weeklyLeaderboard.map((u, i) => (
                  <div
                    key={u.username}
                    className={`board-row ${
                      i === 0 ? "row-gold" : i === 1 ? "row-silver" : i === 2 ? "row-bronze" : ""
                    }`}
                  >
                    <span className="rank">{i < 3 ? RANK_EMOJIS[i] : `#${i + 1}`}</span>
                    <span className="username-col">
                      <span className="username-short">{displayName(u.username)}</span>
                      <span className="username-lc">{u.username}</span>
                    </span>
                    <span className="count-col">
                      <SolveCountBadge count={u.total_solves} />
                      <span className="count-label">problems</span>
                    </span>
                    <span className="bar-col">
                      <ProgressBar value={u.total_solves} max={weekMax} />
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* ── Coder Modal ── */}
            {modal && (
              <div className="modal-overlay" onClick={() => setModal(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <span className="modal-title">{modal.displayName}</span>
                      <span className="modal-sub">// last 5 problems solved</span>
                    </div>
                    <button className="modal-close" onClick={() => setModal(null)}>
                      ✕
                    </button>
                  </div>

                  {modal.loading && (
                    <div className="modal-loading">
                      <div className="modal-spinner" />
                      <span>Fetching from LeetCode...</span>
                    </div>
                  )}

                  {modal.error && <div className="modal-error">⚠ {modal.error}</div>}

                  {modal.problems && (
                    <div className="modal-list">
                      {modal.problems.length === 0 ? (
                        <p className="modal-empty">No recent solved problems found.</p>
                      ) : (
                        modal.problems.map((p, i) => (
                          <div key={p.titleSlug} className="modal-row">
                            <span className="modal-rank">#{i + 1}</span>
                            <div className="modal-problem">
                              <a
                                className="modal-problem-title"
                                href={`https://leetcode.com/problems/${p.titleSlug}/`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {p.title}
                              </a>
                              <span className="modal-solved-at">
                                {new Date(p.solvedAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  timeZone: "Asia/Kolkata",
                                })}
                              </span>
                            </div>
                            <span className={`modal-difficulty diff-${p.difficulty.toLowerCase()}`}>
                              {p.difficulty}
                            </span>
                            <div className="modal-attempts">
                              <span className="modal-attempts-val">{p.submissionCount}</span>
                              <span className="modal-attempts-label">
                                attempt{p.submissionCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── MONTHLY ── */}
            {tab === "month" && (
              <section className="board">
                <div className="board-toolbar">
                  <input
                    className="board-search"
                    placeholder="Search coder..."
                    value={monthSearch}
                    onChange={(e) => setMonthSearch(e.target.value)}
                  />
                  <span className="board-count">
                    {filteredMonthly.length} of {data.monthlyLeaderboard.length} coders
                  </span>
                  <span className="toolbar-sep" />
                  <span className="dl-label">EXPORT</span>
                  <button
                    className="dl-btn dl-csv"
                    onClick={() => downloadCSV(filteredMonthly, data.monthStart, data.monthEnd)}
                  >
                    ↓ CSV
                  </button>
                  <button
                    className="dl-btn dl-pdf"
                    onClick={() => downloadPDF(filteredMonthly, data.monthStart, data.monthEnd)}
                  >
                    ↓ PDF
                  </button>
                </div>
                <div className="board-header">
                  <span>RANK</span>
                  <span>CODER</span>
                  <span>MONTHLY TOTAL</span>
                  <span>PROGRESS</span>
                </div>
                {filteredMonthly.length === 0 ? (
                  <p className="no-data">No coders match your search.</p>
                ) : (
                  filteredMonthly.map((u, i) => (
                    <div
                      key={u.username}
                      className={`board-row ${
                        i === 0 ? "row-gold" : i === 1 ? "row-silver" : i === 2 ? "row-bronze" : ""
                      }`}
                    >
                      <span className="rank">{i < 3 ? RANK_EMOJIS[i] : `#${i + 1}`}</span>
                      <span
                        className="username-col"
                        onClick={() => openCoderModal(u.username)}
                        style={{ cursor: "pointer" }}
                      >
                        <span className="username-short username-link">
                          {displayName(u.username)}
                        </span>
                        <span className="username-lc">{u.username}</span>
                      </span>
                      <span className="count-col">
                        <SolveCountBadge count={u.total_solves} />
                        <span className="count-label">solved</span>
                      </span>
                      <span className="bar-col">
                        <ProgressBar value={u.total_solves} max={monthMax} />
                      </span>
                    </div>
                  ))
                )}
              </section>
            )}

            {/* ── OVERALL ── */}
            {tab === "overall" && (
              <section className="board">
                <div className="board-header">
                  <span>RANK</span>
                  <span>CODER</span>
                  <span>TOTAL SOLVED</span>
                  <span>PROGRESS</span>
                </div>
                {data.overallLeaderboard.map((u, i) => (
                  <div
                    key={u.username}
                    className={`board-row ${
                      i === 0 ? "row-gold" : i === 1 ? "row-silver" : i === 2 ? "row-bronze" : ""
                    }`}
                  >
                    <span className="rank">{i < 3 ? RANK_EMOJIS[i] : `#${i + 1}`}</span>
                    <span className="username-col" onClick={() => router.push(`/profile/${u.username}`)} style={{cursor:"pointer"}}>
                      <span className="username-short username-link">{displayName(u.username)}</span>
                      <span className="username-lc">{u.username}</span>
                    </span>
                    <span className="count-col">
                      <SolveCountBadge count={u.total_solves} />
                      <span className="count-label">solved</span>
                    </span>
                    <span className="bar-col">
                      <ProgressBar value={u.total_solves} max={overallMax} />
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* Sync status */}
            <div className="sync-row">
              <span className="sync-label">LAST SYNC:</span>
              {data.syncResults.map((r) => (
                <span
                  key={r.username}
                  className={`sync-pill ${r.status === "ok" ? "pill-ok" : "pill-err"}`}
                  title={
                    r.error ??
                    (r.backfilledDates?.length
                      ? `Backfilled: ${r.backfilledDates.join(", ")}`
                      : undefined)
                  }
                >
                  {displayName(r.username)}
                  {r.status === "ok" ? ` ✓ (${r.todayCount} today)` : " ✗"}
                  {r.backfilledDates?.length > 0 && ` +${r.backfilledDates.length}↺`}
                </span>
              ))}
            </div>
          </main>
        )}

            {/* ── TODAY PROBLEMS MODAL ── */}
            {todayModal && (
              <div className="modal-overlay" onClick={() => setTodayModal(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <span className="modal-title">{todayModal.displayName}</span>
                      <span className="modal-sub">// problems solved today</span>
                    </div>
                    <button className="modal-close" onClick={() => setTodayModal(null)}>✕</button>
                  </div>
                  {todayModal.loading && <div className="modal-loading"><div className="modal-spinner"/><span>Fetching from LeetCode...</span></div>}
                  {todayModal.error && <div className="modal-error">⚠ {todayModal.error}</div>}
                  {todayModal.problems && (
                    <div className="modal-list">
                      {todayModal.problems.length === 0
                        ? <p className="modal-empty">No problems solved today yet.</p>
                        : todayModal.problems.map((p, i) => (
                          <div key={p.titleSlug} className="modal-row">
                            <span className="modal-rank">#{i+1}</span>
                            <div className="modal-problem">
                              <a className="modal-problem-title" href={`https://leetcode.com/problems/${p.titleSlug}/`} target="_blank" rel="noreferrer">{p.title}</a>
                              <span className="modal-solved-at">{p.lang} · {new Date(p.solvedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"})} IST</span>
                            </div>
                            <span className={`modal-difficulty diff-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
                            <div className="modal-attempts">
                              <span className="modal-attempts-val">{p.submissionCount}</span>
                              <span className="modal-attempts-label">attempt{p.submissionCount!==1?"s":""}</span>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
      </div>

      <style jsx global>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        :root {
          --bg: #0a0c0f;
          --surface: #111318;
          --surface2: #191c22;
          --border: #2a2d35;
          --text: #e2e8f0;
          --dim: #6b7280;
          --accent: #00e5a0;
          --accent2: #00b8d4;
          --gold: #f59e0b;
          --silver: #94a3b8;
          --bronze: #c2845f;
          --danger: #ef4444;
          --mono: "Space Mono", monospace;
          --sans: "Syne", sans-serif;
        }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--mono);
          min-height: 100vh;
          overflow-x: hidden;
        }
        .root {
          position: relative;
          min-height: 100vh;
        }
        .scanlines {
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 100;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          );
        }

        /* HEADER */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          position: sticky;
          top: 0;
          z-index: 50;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .logo-bracket {
          color: var(--accent);
          font-size: 1.4rem;
          font-weight: 700;
        }
        .logo-text {
          color: var(--accent);
          font-size: 1.1rem;
          font-weight: 700;
        }
        .title {
          font-family: var(--sans);
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin-left: 0.4rem;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          flex-wrap: wrap;
        }
        .last-refresh {
          font-size: 0.65rem;
          color: var(--dim);
          letter-spacing: 0.08em;
        }

        .refresh-btn {
          background: transparent;
          border: 1px solid var(--accent);
          color: var(--accent);
          font-family: var(--mono);
          font-size: 0.7rem;
          padding: 0.4rem 1rem;
          cursor: pointer;
          letter-spacing: 0.1em;
          transition: all 0.2s;
        }
        .refresh-btn:hover:not(:disabled) {
          background: var(--accent);
          color: var(--bg);
        }
        .refresh-btn.loading {
          opacity: 0.6;
          cursor: not-allowed;
          border-color: var(--dim);
          color: var(--dim);
        }

        .admin-btn {
          background: transparent;
          border: 1px solid var(--accent2);
          color: var(--accent2);
          font-family: var(--mono);
          font-size: 0.7rem;
          padding: 0.4rem 1rem;
          cursor: pointer;
          letter-spacing: 0.1em;
          transition: all 0.2s;
        }
        .admin-btn:hover {
          background: var(--accent2);
          color: var(--bg);
        }

        .logout-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--dim);
          font-family: var(--mono);
          font-size: 0.7rem;
          padding: 0.4rem 1rem;
          cursor: pointer;
          letter-spacing: 0.1em;
          transition: all 0.2s;
        }
        .logout-btn:hover {
          border-color: var(--danger);
          color: var(--danger);
        }

        /* ERRORS */
        .error-bar {
          background: rgba(239, 68, 68, 0.1);
          border-bottom: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--danger);
          padding: 0.6rem 2rem;
          font-size: 0.8rem;
        }

        /* LOADING */
        .loading-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
        }
        .loading-inner {
          text-align: center;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 1.2rem;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .loading-inner p {
          color: var(--accent);
          font-size: 0.85rem;
        }
        .loading-sub {
          color: var(--dim);
          font-size: 0.7rem;
          margin-top: 0.3rem;
        }

        /* MAIN */
        .main {
          max-width: 960px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
        }

        /* MODAL */
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          backdrop-filter: blur(2px);
        }
        .modal {
          background: var(--surface);
          border: 1px solid var(--border);
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1rem 1.2rem;
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
          gap: 1rem;
        }
        .modal-title {
          font-family: var(--sans);
          font-size: 1rem;
          font-weight: 700;
          color: var(--accent);
          display: block;
        }
        .modal-sub {
          font-size: 0.6rem;
          color: var(--dim);
          margin-top: 0.2rem;
          display: block;
        }
        .modal-close {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--dim);
          font-family: var(--mono);
          font-size: 0.7rem;
          padding: 0.3rem 0.6rem;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .modal-close:hover {
          border-color: var(--danger);
          color: var(--danger);
        }

        .modal-loading {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 2rem 1.2rem;
          color: var(--dim);
          font-size: 0.78rem;
        }
        .modal-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        .modal-error {
          padding: 1.2rem;
          color: var(--danger);
          font-size: 0.75rem;
          background: rgba(239, 68, 68, 0.08);
          border-bottom: 1px solid rgba(239, 68, 68, 0.2);
        }
        .modal-empty {
          padding: 2rem 1.2rem;
          color: var(--dim);
          font-size: 0.78rem;
          text-align: center;
        }

        .modal-list {
          display: flex;
          flex-direction: column;
        }
        .modal-row {
          display: grid;
          grid-template-columns: 1.8rem 1fr 5rem 5rem;
          gap: 0.8rem;
          align-items: center;
          padding: 0.9rem 1.2rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .modal-row:last-child {
          border-bottom: none;
        }
        .modal-row:hover {
          background: var(--surface2);
        }

        .modal-rank {
          font-size: 0.65rem;
          color: var(--dim);
        }
        .modal-problem {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          min-width: 0;
        }
        .modal-problem-title {
          font-size: 0.8rem;
          color: var(--text);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.15s;
        }
        .modal-problem-title:hover {
          color: var(--accent2);
        }
        .modal-solved-at {
          font-size: 0.58rem;
          color: var(--dim);
        }

        .modal-difficulty {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 2px;
          text-align: center;
          letter-spacing: 0.05em;
        }
        .diff-easy {
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
        }
        .diff-medium {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .diff-hard {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
        }
        .diff-unknown {
          color: var(--dim);
          background: var(--surface2);
          border: 1px solid var(--border);
        }

        .modal-attempts {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
        }
        .modal-attempts-val {
          font-size: 1rem;
          font-weight: 700;
          color: var(--accent2);
          font-family: var(--sans);
        }
        .modal-attempts-label {
          font-size: 0.55rem;
          color: var(--dim);
        }

        .username-link:hover {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        /* DATE BADGE */
        .date-badge {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1rem;
          font-size: 0.72rem;
          flex-wrap: wrap;
        }
        .date-label {
          color: var(--accent2);
          letter-spacing: 0.12em;
        }
        .date-val {
          color: var(--text);
        }
        .date-sep {
          color: var(--border);
        }
        .backfill-badge {
          font-size: 0.62rem;
          color: var(--accent);
          background: rgba(0, 229, 160, 0.08);
          border: 1px solid rgba(0, 229, 160, 0.2);
          padding: 0.15rem 0.5rem;
        }

        /* LEGEND */
        .legend {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        .legend-label {
          font-size: 0.58rem;
          color: var(--dim);
          letter-spacing: 0.1em;
          margin-right: 0.3rem;
        }
        .legend-pill {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.55rem;
          border-radius: 2px;
          font-family: var(--mono);
        }

        /* TABS */
        .tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          margin-bottom: 2rem;
        }
        .tab {
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--dim);
          font-family: var(--mono);
          font-size: 0.7rem;
          letter-spacing: 0.1em;
          padding: 0.6rem 1.2rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .tab:hover {
          color: var(--text);
        }
        .tab-active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        /* BOARD */
        .board {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
        }
        .board-header {
          display: grid;
          grid-template-columns: 3rem 1fr 9rem 1fr;
          gap: 1rem;
          padding: 0.6rem 1.2rem;
          background: var(--surface2);
          font-size: 0.62rem;
          letter-spacing: 0.12em;
          color: var(--dim);
          border-bottom: 1px solid var(--border);
        }
        .board-row {
          display: grid;
          grid-template-columns: 3rem 1fr 9rem 1fr;
          gap: 1rem;
          align-items: center;
          padding: 0.85rem 1.2rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .board-row:last-child {
          border-bottom: none;
        }
        .board-row:hover {
          background: var(--surface2);
        }
        .row-gold {
          background: rgba(245, 158, 11, 0.04);
        }
        .row-silver {
          background: rgba(148, 163, 184, 0.03);
        }
        .row-bronze {
          background: rgba(194, 132, 95, 0.03);
        }
        .rank {
          font-size: 1.1rem;
        }

        .username-col {
          display: flex;
          flex-direction: column;
        }
        .username-short {
          font-family: var(--sans);
          font-weight: 600;
          font-size: 0.95rem;
        }
        .username-lc {
          font-size: 0.6rem;
          color: var(--dim);
          margin-top: 1px;
        }

        .count-col {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .solve-badge {
          font-size: 1rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 3px;
          min-width: 2.2rem;
          text-align: center;
          font-family: var(--mono);
          transition: all 0.3s;
        }
        .count-label {
          font-size: 0.6rem;
          color: var(--dim);
        }

        .bar-col {
          display: flex;
          align-items: center;
        }
        .bar-track {
          width: 100%;
          height: 7px;
          background: var(--surface2);
          border-radius: 4px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.7s ease, background 0.7s ease;
        }

        /* SYNC */
        .sync-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.4rem;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .sync-label {
          font-size: 0.6rem;
          color: var(--dim);
          letter-spacing: 0.1em;
        }
        .sync-pill {
          font-size: 0.6rem;
          padding: 0.2rem 0.6rem;
          border-radius: 2px;
          cursor: default;
        }
        .pill-ok {
          background: rgba(0, 229, 160, 0.1);
          color: var(--accent);
          border: 1px solid rgba(0, 229, 160, 0.2);
        }
        .pill-err {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        @media (max-width: 600px) {
          .header {
            padding: 0.8rem 1rem;
          }
          .title {
            font-size: 0.85rem;
          }
          .main {
            padding: 1rem;
          }
          .board-header,
          .board-row {
            grid-template-columns: 2.5rem 1fr 4.5rem;
          }
          .board-header span:last-child,
          .board-row .bar-col {
            display: none;
          }
        }

        /* MONTHLY TOOLBAR */
        .board-toolbar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.7rem 1.2rem;
          background: var(--surface2);
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .board-search {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--mono);
          font-size: 0.72rem;
          padding: 0.35rem 0.7rem;
          outline: none;
          transition: border-color 0.2s;
          width: 180px;
        }
        .board-search:focus {
          border-color: var(--accent);
        }
        .board-search::placeholder {
          color: var(--border);
        }
        .board-count {
          font-size: 0.6rem;
          color: var(--dim);
        }
        .toolbar-sep {
          flex: 1;
        }
        .dl-label {
          font-size: 0.58rem;
          color: var(--dim);
          letter-spacing: 0.1em;
        }
        .dl-btn {
          background: transparent;
          font-family: var(--mono);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 0.35rem 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 1px;
        }
        .dl-csv {
          border: 1px solid rgba(0, 180, 212, 0.4);
          color: var(--accent2);
        }
        .dl-csv:hover {
          background: rgba(0, 180, 212, 0.1);
          border-color: var(--accent2);
        }
        .dl-pdf {
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #f59e0b;
        }
        .dl-pdf:hover {
          background: rgba(245, 158, 11, 0.1);
          border-color: #f59e0b;
        }

        .no-data {
          color: var(--dim);
          font-size: 0.8rem;
          padding: 2rem;
          text-align: center;
        }

        /* MODAL */
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .modal {
          background: var(--surface);
          border: 1px solid var(--border);
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1rem 1.2rem;
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
          gap: 1rem;
        }
        .modal-title {
          font-family: var(--sans);
          font-size: 1rem;
          font-weight: 700;
          color: var(--accent);
          display: block;
        }
        .modal-sub {
          font-size: 0.6rem;
          color: var(--dim);
          margin-top: 0.2rem;
          display: block;
        }
        .modal-close {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--dim);
          font-family: var(--mono);
          font-size: 0.7rem;
          padding: 0.3rem 0.6rem;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .modal-close:hover {
          border-color: var(--danger);
          color: var(--danger);
        }
        .modal-loading {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 2rem 1.2rem;
          color: var(--dim);
          font-size: 0.78rem;
        }
        .modal-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        .modal-error {
          padding: 1.2rem;
          color: var(--danger);
          font-size: 0.75rem;
          background: rgba(239, 68, 68, 0.08);
        }
        .modal-empty {
          padding: 2rem 1.2rem;
          color: var(--dim);
          font-size: 0.78rem;
          text-align: center;
        }
        .modal-list {
          display: flex;
          flex-direction: column;
        }
        .modal-row {
          display: grid;
          grid-template-columns: 1.8rem 1fr 5rem 5rem;
          gap: 0.8rem;
          align-items: center;
          padding: 0.9rem 1.2rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .modal-row:last-child {
          border-bottom: none;
        }
        .modal-row:hover {
          background: var(--surface2);
        }
        .modal-rank {
          font-size: 0.65rem;
          color: var(--dim);
        }
        .modal-problem {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          min-width: 0;
        }
        .modal-problem-title {
          font-size: 0.8rem;
          color: var(--text);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .modal-problem-title:hover {
          color: var(--accent2);
        }
        .modal-solved-at {
          font-size: 0.58rem;
          color: var(--dim);
        }
        .modal-difficulty {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 2px;
          text-align: center;
          letter-spacing: 0.05em;
        }
        .diff-easy {
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
        }
        .diff-medium {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .diff-hard {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
        }
        .diff-unknown {
          color: var(--dim);
          background: var(--surface2);
          border: 1px solid var(--border);
        }
        .modal-attempts {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
        }
        .modal-attempts-val {
          font-size: 1rem;
          font-weight: 700;
          color: var(--accent2);
          font-family: var(--sans);
        }
        .modal-attempts-label {
          font-size: 0.55rem;
          color: var(--dim);
        }
        .username-link:hover {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </>
  );
}
