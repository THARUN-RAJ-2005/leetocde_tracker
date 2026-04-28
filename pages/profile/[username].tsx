import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Head from "next/head";

interface TopicStat { topicName: string; problemsSolved: number; }
interface RecentSub { title: string; titleSlug: string; timestamp: string; statusDisplay: string; lang: string; }
interface Profile {
  username: string; realName: string; ranking: number;
  totalSolved: number; easySolved: number; mediumSolved: number; hardSolved: number;
  acceptanceRate: number; topicStats: TopicStat[];
  recentSubmissions: RecentSub[];
}
interface ActivityRow { date: string; solve_count: number; }

const DIFF_COLORS: Record<string,string> = { Easy: "#22c55e", Medium: "#f59e0b", Hard: "#ef4444" };

function ActivityHeatmap({ activity }: { activity: ActivityRow[] }) {
  const map: Record<string, number> = {};
  for (const r of activity) map[r.date] = r.solve_count;
  const max = Math.max(1, ...Object.values(map));
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    cells.push({ date: ds, count: map[ds] ?? 0 });
  }
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const getColor = (c: number) => {
    if (c === 0) return "var(--surface2)";
    const p = c / max;
    if (p < 0.25) return "rgba(0,229,160,0.2)";
    if (p < 0.5) return "rgba(0,229,160,0.45)";
    if (p < 0.75) return "rgba(0,229,160,0.7)";
    return "#00e5a0";
  };
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {week.map(cell => (
            <div key={cell.date} title={`${cell.date}: ${cell.count} solved`}
              style={{ width: 12, height: 12, borderRadius: 2, background: getColor(cell.count) }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { username } = router.query as { username: string };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [trackedTotal, setTrackedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true); setError(null);
    fetch(`/api/user-profile?username=${encodeURIComponent(username)}`)
      .then(r => { if (r.status === 401) { router.replace("/login"); throw new Error("unauth"); } return r.json(); })
      .then(d => { if (d.error) throw new Error(d.error); setProfile(d.profile); setActivity(d.activity); setTrackedTotal(d.trackedTotal); })
      .catch(e => { if (e.message !== "unauth") setError(e.message); })
      .finally(() => setLoading(false));
  }, [username, router]);

  const topStrong = profile?.topicStats.slice(0, 6) ?? [];
  const topWeak = [...(profile?.topicStats ?? [])].filter(t => t.problemsSolved > 0).slice(-6).reverse();
  const topicsMax = Math.max(1, ...(profile?.topicStats.map(t => t.problemsSolved) ?? [1]));

  return (
    <>
      <Head>
        <title>{username} — LC Profile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet" />
      </Head>
      <div className="root">
        <div className="scanlines" />
        <header className="header">
          <button className="back-btn" onClick={() => router.back()}>← BACK</button>
          <span className="logo-bracket">[</span><span className="logo-text">LC</span><span className="logo-bracket">]</span>
          <span className="title">Profile</span>
        </header>

        {loading && <div className="center-screen"><div className="spinner" /><p style={{color:"var(--accent)",fontSize:"0.8rem",marginTop:"1rem"}}>Fetching from LeetCode...</p></div>}
        {error && <div className="center-screen"><p style={{color:"var(--danger)"}}> ⚠ {error}</p></div>}

        {profile && (
          <main className="main">
            <div className="hero">
              <div className="hero-avatar">{(profile.realName || username)?.[0]?.toUpperCase()}</div>
              <div className="hero-info">
                <h1 className="hero-name">{profile.realName || username}</h1>
                <p className="hero-uname">@{username}</p>
                <div className="hero-badges">
                  <span className="badge b-rank">🌍 #{profile.ranking?.toLocaleString()}</span>
                  <span className="badge b-acc">{profile.acceptanceRate}% acceptance</span>
                  <span className="badge b-track">{trackedTotal} tracked here</span>
                </div>
              </div>
              <a className="lc-link" href={`https://leetcode.com/${username}/`} target="_blank" rel="noreferrer">View on LeetCode ↗</a>
            </div>

            <div className="stats-grid">
              {[
                { val: profile.totalSolved, label: "TOTAL SOLVED", color: "var(--accent)" },
                { val: profile.easySolved, label: "EASY", color: DIFF_COLORS.Easy },
                { val: profile.mediumSolved, label: "MEDIUM", color: DIFF_COLORS.Medium },
                { val: profile.hardSolved, label: "HARD", color: DIFF_COLORS.Hard },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <span className="stat-num" style={{ color: s.color }}>{s.val}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="section-card">
              <div className="section-title">DIFFICULTY BREAKDOWN</div>
              {[{l:"Easy",c:profile.easySolved,col:DIFF_COLORS.Easy},{l:"Medium",c:profile.mediumSolved,col:DIFF_COLORS.Medium},{l:"Hard",c:profile.hardSolved,col:DIFF_COLORS.Hard}].map(d=>(
                <div key={d.l} className="diff-row">
                  <span className="diff-label" style={{color:d.col}}>{d.l}</span>
                  <div className="diff-track"><div className="diff-fill" style={{width:`${profile.totalSolved>0?(d.c/profile.totalSolved)*100:0}%`,background:d.col}}/></div>
                  <span className="diff-count">{d.c}</span>
                </div>
              ))}
            </div>

            <div className="section-card">
              <div className="section-title">ACTIVITY — LAST 90 DAYS</div>
              <div style={{overflowX:"auto",paddingBottom:"0.5rem"}}><ActivityHeatmap activity={activity}/></div>
              <div className="heatmap-legend">
                <span style={{fontSize:"0.6rem",color:"var(--dim)"}}>Less</span>
                {[0.2,0.45,0.7,1].map((o,i)=><span key={i} style={{display:"inline-block",width:12,height:12,borderRadius:2,background:`rgba(0,229,160,${o})`,verticalAlign:"middle",margin:"0 2px"}}/>)}
                <span style={{fontSize:"0.6rem",color:"var(--dim)"}}>More</span>
              </div>
            </div>

            <div className="two-col">
              <div className="section-card">
                <div className="section-title">💪 STRONG TOPICS</div>
                {topStrong.map(t=>(
                  <div key={t.topicName} className="topic-row">
                    <span className="topic-name">{t.topicName}</span>
                    <div className="topic-track"><div className="topic-fill" style={{width:`${(t.problemsSolved/topicsMax)*100}%`,background:"var(--accent)"}}/></div>
                    <span className="topic-count">{t.problemsSolved}</span>
                  </div>
                ))}
              </div>
              <div className="section-card">
                <div className="section-title">⚠ WEAK TOPICS</div>
                {topWeak.map(t=>(
                  <div key={t.topicName} className="topic-row">
                    <span className="topic-name">{t.topicName}</span>
                    <div className="topic-track"><div className="topic-fill" style={{width:`${(t.problemsSolved/topicsMax)*100}%`,background:"var(--danger)"}}/></div>
                    <span className="topic-count">{t.problemsSolved}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card">
              <div className="section-title">RECENT SUBMISSIONS</div>
              <div className="sub-list">
                <div className="sub-header"><span>PROBLEM</span><span>LANG</span><span>STATUS</span><span>DATE</span></div>
                {profile.recentSubmissions.slice(0,10).map((s,i)=>(
                  <div key={i} className="sub-row">
                    <a className="sub-title" href={`https://leetcode.com/problems/${s.titleSlug}/`} target="_blank" rel="noreferrer">{s.title}</a>
                    <span className="sub-lang">{s.lang}</span>
                    <span className={`sub-status ${s.statusDisplay==="Accepted"?"ac":"wa"}`}>{s.statusDisplay}</span>
                    <span className="sub-time">{new Date(parseInt(s.timestamp)*1000).toLocaleDateString("en-IN",{day:"numeric",month:"short",timeZone:"Asia/Kolkata"})}</span>
                  </div>
                ))}
              </div>
            </div>
          </main>
        )}
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0c0f;--surface:#111318;--surface2:#191c22;--border:#2a2d35;--text:#e2e8f0;--dim:#6b7280;--accent:#00e5a0;--accent2:#00b8d4;--danger:#ef4444;--mono:'Space Mono',monospace;--sans:'Syne',sans-serif}
        body{background:var(--bg);color:var(--text);font-family:var(--mono);min-height:100vh}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <style jsx>{`
        .root{position:relative;min-height:100vh}
        .scanlines{pointer-events:none;position:fixed;inset:0;z-index:100;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)}
        .header{display:flex;align-items:center;gap:0.6rem;padding:1rem 2rem;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:50}
        .back-btn{background:transparent;border:1px solid var(--border);color:var(--dim);font-family:var(--mono);font-size:0.65rem;padding:0.35rem 0.8rem;cursor:pointer;letter-spacing:0.08em;transition:all 0.2s}
        .back-btn:hover{border-color:var(--accent2);color:var(--accent2)}
        .logo-bracket{color:var(--accent);font-size:1.3rem;font-weight:700}
        .logo-text{color:var(--accent);font-size:1rem;font-weight:700}
        .title{font-family:var(--sans);font-size:1rem;font-weight:800;margin-left:0.3rem}
        .center-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh}
        .spinner{width:40px;height:40px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite}
        .main{max-width:900px;margin:0 auto;padding:2rem 1.5rem;display:flex;flex-direction:column;gap:1.5rem}
        .hero{display:flex;align-items:center;gap:1.5rem;background:var(--surface);border:1px solid var(--border);padding:1.5rem;flex-wrap:wrap}
        .hero-avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--accent2),var(--accent));display:flex;align-items:center;justify-content:center;font-family:var(--sans);font-size:1.8rem;font-weight:800;color:#0a0c0f;flex-shrink:0}
        .hero-info{flex:1;min-width:0}
        .hero-name{font-family:var(--sans);font-size:1.4rem;font-weight:800}
        .hero-uname{font-size:0.7rem;color:var(--dim);margin-top:0.2rem}
        .hero-badges{display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap}
        .badge{font-size:0.62rem;padding:0.2rem 0.6rem;border-radius:2px;letter-spacing:0.06em}
        .b-rank{background:rgba(0,184,212,0.1);border:1px solid rgba(0,184,212,0.3);color:var(--accent2)}
        .b-acc{background:rgba(0,229,160,0.1);border:1px solid rgba(0,229,160,0.3);color:var(--accent)}
        .b-track{background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.3);color:#84cc16}
        .lc-link{font-size:0.65rem;color:var(--accent2);text-decoration:none;border:1px solid rgba(0,184,212,0.3);padding:0.4rem 0.8rem;transition:all 0.2s;white-space:nowrap}
        .lc-link:hover{background:rgba(0,184,212,0.1)}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
        .stat-card{background:var(--surface);border:1px solid var(--border);padding:1.2rem;display:flex;flex-direction:column;align-items:center;gap:0.3rem}
        .stat-num{font-family:var(--sans);font-size:2rem;font-weight:800}
        .stat-label{font-size:0.58rem;color:var(--dim);letter-spacing:0.12em}
        .section-card{background:var(--surface);border:1px solid var(--border);padding:1.2rem}
        .section-title{font-size:0.65rem;letter-spacing:0.14em;color:var(--accent);margin-bottom:1rem}
        .diff-row{display:flex;align-items:center;gap:0.8rem;margin-bottom:0.7rem}
        .diff-label{font-size:0.7rem;font-weight:700;width:4.5rem}
        .diff-track{flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden}
        .diff-fill{height:100%;border-radius:3px;transition:width 0.7s ease}
        .diff-count{font-size:0.7rem;color:var(--dim);width:2.5rem;text-align:right}
        .heatmap-legend{margin-top:0.6rem;display:flex;align-items:center;gap:4px}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
        .topic-row{display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem}
        .topic-name{font-size:0.68rem;width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
        .topic-track{flex:1;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden}
        .topic-fill{height:100%;border-radius:3px;max-width:100%}
        .topic-count{font-size:0.65rem;color:var(--dim);width:2rem;text-align:right}
        .sub-list{display:flex;flex-direction:column}
        .sub-header{display:grid;grid-template-columns:1fr 5rem 8rem 5rem;gap:0.8rem;font-size:0.58rem;letter-spacing:0.1em;color:var(--dim);padding:0.4rem 0;border-bottom:1px solid var(--border);margin-bottom:0.3rem}
        .sub-row{display:grid;grid-template-columns:1fr 5rem 8rem 5rem;gap:0.8rem;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border);font-size:0.75rem}
        .sub-row:last-child{border-bottom:none}
        .sub-title{color:var(--accent2);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sub-title:hover{text-decoration:underline}
        .sub-lang{font-size:0.62rem;color:var(--dim)}
        .sub-status.ac{color:#22c55e;font-size:0.65rem}
        .sub-status.wa{color:var(--danger);font-size:0.65rem}
        .sub-time{font-size:0.62rem;color:var(--dim)}
        @media(max-width:600px){
          .stats-grid{grid-template-columns:repeat(2,1fr)}
          .two-col{grid-template-columns:1fr}
          .sub-header,.sub-row{grid-template-columns:1fr 6rem}
          .sub-header span:nth-child(2),.sub-header span:nth-child(4),.sub-lang,.sub-time{display:none}
        }
      `}</style>
    </>
  );
}
