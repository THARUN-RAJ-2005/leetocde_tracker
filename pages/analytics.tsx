import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { MEMBERS, MEMBER_DISPLAY } from "@/students_list";

interface UserTotal { username:string; total_solved:number; easy_solved:number; medium_solved:number; hard_solved:number; acceptance_rate:number; ranking:number; }
interface ActivityRow { username:string; date:string; solve_count:number; }
interface TopicRow { username:string; topic_name:string; problem_count:number; }
interface WeeklyRow { username:string; week_start:string; weekly_total:number; }
interface MonthlyRow { username:string; month:string; monthly_total:number; }
interface GroupRank { username:string; total:number; }

const COLORS = ["#00e5a0","#00b8d4","#f59e0b","#ef4444","#a78bfa","#fb923c","#34d399","#60a5fa"];
const DIFF_COL: Record<string,string> = { easy:"#22c55e", medium:"#f59e0b", hard:"#ef4444" };

function displayName(u:string){ return (MEMBER_DISPLAY as Record<string,string>)[u] || u; }

function MiniBar({ val, max, color }: { val:number; max:number; color:string }) {
  return (
    <div style={{ flex:1, height:8, background:"#191c22", borderRadius:4, overflow:"hidden" }}>
      <div style={{ width:`${max>0?(val/max)*100:0}%`, height:"100%", background:color, borderRadius:4, transition:"width 0.5s" }} />
    </div>
  );
}

function LineChart({ data, users, valueKey, labelKey }: {
  data: Record<string, Record<string,number>>; users: string[];
  valueKey: string; labelKey: string;
}) {
  const labels = Array.from(new Set(
    users.flatMap(u => Object.keys(data[u] ?? {}))
  )).sort();
  if (!labels.length) return <p style={{color:"var(--dim)",fontSize:"0.75rem",padding:"1rem"}}>No data yet.</p>;

  const allVals = users.flatMap(u => labels.map(l => data[u]?.[l] ?? 0));
  const maxVal = Math.max(1, ...allVals);
  const W = 600, H = 180, PAD = 36;
  const xStep = labels.length > 1 ? (W - PAD * 2) / (labels.length - 1) : 0;

  return (
    <div style={{ overflowX:"auto" }}>
      <svg viewBox={`0 0 ${W} ${H+40}`} style={{ width:"100%", minWidth:300, fontFamily:"'Space Mono',monospace" }}>
        {/* grid lines */}
        {[0,0.25,0.5,0.75,1].map(pct => (
          <g key={pct}>
            <line x1={PAD} y1={H-pct*(H-PAD)+PAD/2} x2={W-PAD} y2={H-pct*(H-PAD)+PAD/2} stroke="#2a2d35" strokeWidth={1}/>
            <text x={PAD-4} y={H-pct*(H-PAD)+PAD/2+4} textAnchor="end" fontSize={9} fill="#6b7280">{Math.round(pct*maxVal)}</text>
          </g>
        ))}
        {/* x labels — show every nth */}
        {labels.map((l,i) => {
          const skip = Math.ceil(labels.length / 8);
          if (i % skip !== 0 && i !== labels.length-1) return null;
          const x = PAD + i * xStep;
          const shortL = l.length > 7 ? l.slice(5) : l;
          return <text key={l} x={x} y={H+PAD/2+24} textAnchor="middle" fontSize={9} fill="#6b7280">{shortL}</text>;
        })}
        {/* lines */}
        {users.map((u,ui) => {
          const col = COLORS[ui % COLORS.length];
          const pts = labels.map((l,i) => {
            const v = data[u]?.[l] ?? 0;
            const x = PAD + i * xStep;
            const y = PAD/2 + (H - PAD/2) - (v / maxVal) * (H - PAD);
            return `${x},${y}`;
          });
          return (
            <g key={u}>
              <polyline points={pts.join(" ")} fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round"/>
              {labels.map((l,i) => {
                const v = data[u]?.[l] ?? 0;
                const x = PAD + i * xStep;
                const y = PAD/2 + (H - PAD/2) - (v / maxVal) * (H - PAD);
                return <circle key={l} cx={x} cy={y} r={3} fill={col}>
                  <title>{displayName(u)}: {v} on {l}</title>
                </circle>;
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", marginTop:"0.5rem" }}>
        {users.map((u,ui) => (
          <span key={u} style={{ fontSize:"0.62rem", color:COLORS[ui%COLORS.length], display:"flex", alignItems:"center", gap:"0.3rem" }}>
            <span style={{ display:"inline-block", width:12, height:3, background:COLORS[ui%COLORS.length], borderRadius:2 }}/>
            {displayName(u)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RadarChart({ users, topics, topicData }: { users:string[]; topics:string[]; topicData:Record<string,Record<string,number>>; }) {
  if (!topics.length) return <p style={{color:"var(--dim)",fontSize:"0.75rem",padding:"1rem"}}>No topic data.</p>;
  const N = Math.min(8, topics.length);
  const topN = topics.slice(0, N);
  const CX=150,CY=150,R=110;
  const maxVal = Math.max(1, ...users.flatMap(u => topN.map(t => topicData[u]?.[t] ?? 0)));

  const angle = (i:number) => (Math.PI * 2 * i / N) - Math.PI/2;
  const pt = (i:number, pct:number) => ({
    x: CX + R * pct * Math.cos(angle(i)),
    y: CY + R * pct * Math.sin(angle(i)),
  });

  return (
    <div style={{ overflowX:"auto" }}>
      <svg viewBox="0 0 300 320" style={{ width:"100%", maxWidth:320 }}>
        {/* grid rings */}
        {[0.25,0.5,0.75,1].map(pct => (
          <polygon key={pct} fill="none" stroke="#2a2d35" strokeWidth={1}
            points={topN.map((_,i) => { const p=pt(i,pct); return `${p.x},${p.y}`; }).join(" ")} />
        ))}
        {/* axes */}
        {topN.map((_,i) => { const p=pt(i,1); return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#2a2d35" strokeWidth={1}/>; })}
        {/* labels */}
        {topN.map((t,i) => {
          const p=pt(i,1.2);
          return <text key={t} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#6b7280">
            {t.length>10?t.slice(0,10)+"…":t}
          </text>;
        })}
        {/* user polygons */}
        {users.map((u,ui) => {
          const col = COLORS[ui%COLORS.length];
          const pts = topN.map((_,i) => { const v=topicData[u]?.[topN[i]]??0; const p=pt(i,v/maxVal); return `${p.x},${p.y}`; });
          return <polygon key={u} points={pts.join(" ")} fill={col} fillOpacity={0.15} stroke={col} strokeWidth={2}/>;
        })}
      </svg>
      <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", marginTop:"0.5rem" }}>
        {users.map((u,ui) => (
          <span key={u} style={{ fontSize:"0.62rem", color:COLORS[ui%COLORS.length] }}>
            ◆ {displayName(u)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    totals: UserTotal[]; activity: ActivityRow[]; topics: TopicRow[];
    weeklyTrend: WeeklyRow[]; monthlyTrend: MonthlyRow[]; groupRanking: GroupRank[];
  } | null>(null);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r=>r.json()).then(d=>{
      if (!d.loggedIn || !d.user?.isAdmin) router.replace("/login");
      else setAuthChecked(true);
    }).catch(()=>router.replace("/login"));
  }, [router]);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedUsers.length) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?users=${selectedUsers.join(",")}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch(e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }, [selectedUsers]);

  useEffect(() => { if (selectedUsers.length) fetchAnalytics(); }, [selectedUsers, fetchAnalytics]);

  const filteredMembers = MEMBERS.filter(u =>
    displayName(u).toLowerCase().includes(search.toLowerCase()) ||
    u.toLowerCase().includes(search.toLowerCase())
  );

  // Transform data for charts
  const weeklyData: Record<string,Record<string,number>> = {};
  const monthlyData: Record<string,Record<string,number>> = {};
  const topicData: Record<string,Record<string,number>> = {};
  const allTopics: Set<string> = new Set();
  if (data) {
    for (const r of data.weeklyTrend) { if (!weeklyData[r.username]) weeklyData[r.username]={}; weeklyData[r.username][r.week_start]=r.weekly_total; }
    for (const r of data.monthlyTrend) { if (!monthlyData[r.username]) monthlyData[r.username]={}; monthlyData[r.username][r.month]=r.monthly_total; }
    for (const r of data.topics) { if (!topicData[r.username]) topicData[r.username]={}; topicData[r.username][r.topic_name]=r.problem_count; allTopics.add(r.topic_name); }
  }
  const topicList = Array.from(allTopics).sort((a,b)=>{
    const sa=selectedUsers.reduce((s,u)=>s+(topicData[u]?.[a]??0),0);
    const sb=selectedUsers.reduce((s,u)=>s+(topicData[u]?.[b]??0),0);
    return sb-sa;
  });
  const totalMap = Object.fromEntries((data?.totals??[]).map(t=>[t.username,t]));
  const maxSolved = Math.max(1,...(data?.groupRanking??[]).map(r=>r.total));

  if (!authChecked) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#0a0c0f"}}>
      <div style={{width:32,height:32,border:"2px solid #2a2d35",borderTopColor:"#00e5a0",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <Head>
        <title>Analytics — LC Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet"/>
      </Head>
      <div className="root">
        <div className="scanlines"/>
        <header className="header">
          <div className="header-left">
            <span className="logo-bracket">[</span><span className="logo-text">LC</span><span className="logo-bracket">]</span>
            <span className="title">Analytics</span>
            <span className="admin-badge">ADMIN</span>
          </div>
          <div className="header-right">
            <button className="nav-btn" onClick={()=>router.push("/admin")}>← ADMIN</button>
            <button className="nav-btn" onClick={()=>router.push("/")}>TRACKER</button>
          </div>
        </header>

        <div className="layout">
          {/* Sidebar - user selector */}
          <aside className="sidebar">
            <div className="sidebar-title">SELECT CODERS</div>
            <div className="sidebar-sub">Compare up to 4 users</div>
            <input className="sidebar-search" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <div className="user-list">
              {filteredMembers.map(u => {
                const sel = selectedUsers.includes(u);
                const idx = selectedUsers.indexOf(u);
                const col = sel ? COLORS[idx % COLORS.length] : undefined;
                return (
                  <button key={u} className={`user-item ${sel?"selected":""}`}
                    style={sel ? { borderColor:col, background:`${col}18`, color:col } : {}}
                    onClick={()=>{
                      if (sel) setSelectedUsers(p=>p.filter(x=>x!==u));
                      else if (selectedUsers.length < 4) setSelectedUsers(p=>[...p,u]);
                    }}>
                    {sel && <span style={{ background:col, width:8, height:8, borderRadius:"50%", display:"inline-block", marginRight:6 }}/>}
                    <span className="user-item-name">{displayName(u)}</span>
                    <span className="user-item-lc">{u}</span>
                  </button>
                );
              })}
            </div>
            {selectedUsers.length > 0 && (
              <button className="clear-btn" onClick={()=>setSelectedUsers([])}>✕ CLEAR ALL</button>
            )}
          </aside>

          {/* Main panel */}
          <main className="panel">
            {!selectedUsers.length && (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <p>Select 1–4 coders from the left panel to compare their performance.</p>
              </div>
            )}

            {loading && (
              <div className="center-load">
                <div className="spinner"/>
                <p style={{color:"var(--accent)",fontSize:"0.8rem",marginTop:"1rem"}}>Loading analytics...</p>
              </div>
            )}

            {error && <div className="error-box">⚠ {error}</div>}

            {data && !loading && (
              <>
                {/* Group ranking */}
                <div className="card">
                  <div className="card-title">GROUP RANKING</div>
                  {data.groupRanking.map((r,i)=>(
                    <div key={r.username} className="rank-row">
                      <span className="rank-pos">{i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</span>
                      <span className="rank-name" style={{color:COLORS[selectedUsers.indexOf(r.username)%COLORS.length]}}>{displayName(r.username)}</span>
                      <MiniBar val={r.total} max={maxSolved} color={COLORS[selectedUsers.indexOf(r.username)%COLORS.length]}/>
                      <span className="rank-val">{r.total}</span>
                    </div>
                  ))}
                </div>

                {/* User stats cards */}
                <div className="stats-row">
                  {selectedUsers.map((u,ui)=>{
                    const t = totalMap[u];
                    const col = COLORS[ui%COLORS.length];
                    if (!t) return (
                      <div key={u} className="user-stat-card" style={{borderColor:col}}>
                        <div className="user-stat-name" style={{color:col}}>{displayName(u)}</div>
                        <p style={{fontSize:"0.65rem",color:"var(--dim)"}}>Sync needed for LeetCode stats</p>
                      </div>
                    );
                    return (
                      <div key={u} className="user-stat-card" style={{borderColor:col}}>
                        <div className="user-stat-name" style={{color:col}}>{displayName(u)}</div>
                        <div className="user-stat-grid">
                          <div><span className="us-num">{t.total_solved}</span><span className="us-lbl">TOTAL</span></div>
                          <div><span className="us-num" style={{color:"#22c55e"}}>{t.easy_solved}</span><span className="us-lbl">EASY</span></div>
                          <div><span className="us-num" style={{color:"#f59e0b"}}>{t.medium_solved}</span><span className="us-lbl">MED</span></div>
                          <div><span className="us-num" style={{color:"#ef4444"}}>{t.hard_solved}</span><span className="us-lbl">HARD</span></div>
                          <div><span className="us-num">{t.acceptance_rate}%</span><span className="us-lbl">ACC</span></div>
                          <div><span className="us-num">#{t.ranking?.toLocaleString()||"—"}</span><span className="us-lbl">RANK</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weekly trend */}
                <div className="card">
                  <div className="card-title">WEEKLY ACTIVITY TREND</div>
                  <LineChart data={weeklyData} users={selectedUsers} valueKey="weekly_total" labelKey="week_start"/>
                </div>

                {/* Monthly trend */}
                <div className="card">
                  <div className="card-title">MONTHLY TREND (6 MONTHS)</div>
                  <LineChart data={monthlyData} users={selectedUsers} valueKey="monthly_total" labelKey="month"/>
                </div>

                {/* Radar - topic comparison */}
                <div className="two-col">
                  <div className="card">
                    <div className="card-title">TOPIC RADAR</div>
                    <RadarChart users={selectedUsers} topics={topicList} topicData={topicData}/>
                  </div>
                  <div className="card">
                    <div className="card-title">TOP TOPICS COMPARISON</div>
                    {topicList.slice(0,8).map(topic=>(
                      <div key={topic} style={{marginBottom:"0.8rem"}}>
                        <div style={{fontSize:"0.62rem",color:"var(--dim)",marginBottom:"0.3rem"}}>{topic}</div>
                        {selectedUsers.map((u,ui)=>{
                          const v = topicData[u]?.[topic]??0;
                          const col = COLORS[ui%COLORS.length];
                          const max = Math.max(1,...selectedUsers.map(x=>topicData[x]?.[topic]??0));
                          return (
                            <div key={u} style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.2rem"}}>
                              <span style={{fontSize:"0.58rem",color:col,width:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName(u)}</span>
                              <MiniBar val={v} max={max} color={col}/>
                              <span style={{fontSize:"0.62rem",color:"var(--dim)",width:"1.5rem",textAlign:"right"}}>{v}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0c0f;--surface:#111318;--surface2:#191c22;--border:#2a2d35;--text:#e2e8f0;--dim:#6b7280;--accent:#00e5a0;--accent2:#00b8d4;--danger:#ef4444;--mono:'Space Mono',monospace;--sans:'Syne',sans-serif}
        body{background:var(--bg);color:var(--text);font-family:var(--mono);min-height:100vh}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <style jsx>{`
        .root{position:relative;min-height:100vh;display:flex;flex-direction:column}
        .scanlines{pointer-events:none;position:fixed;inset:0;z-index:100;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)}
        .header{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:50;flex-wrap:wrap;gap:0.5rem}
        .header-left,.header-right{display:flex;align-items:center;gap:0.5rem}
        .logo-bracket{color:var(--accent);font-size:1.3rem;font-weight:700}
        .logo-text{color:var(--accent);font-size:1rem;font-weight:700}
        .title{font-family:var(--sans);font-size:1rem;font-weight:800;margin-left:0.3rem}
        .admin-badge{font-size:0.55rem;background:rgba(0,229,160,0.1);border:1px solid rgba(0,229,160,0.3);color:var(--accent);padding:0.15rem 0.5rem;letter-spacing:0.1em;margin-left:0.3rem}
        .nav-btn{background:transparent;border:1px solid var(--border);color:var(--dim);font-family:var(--mono);font-size:0.65rem;padding:0.35rem 0.8rem;cursor:pointer;letter-spacing:0.08em;transition:all 0.2s}
        .nav-btn:hover{border-color:var(--accent2);color:var(--accent2)}
        .layout{display:flex;flex:1;min-height:0}
        .sidebar{width:240px;flex-shrink:0;border-right:1px solid var(--border);background:var(--surface);padding:1.2rem;display:flex;flex-direction:column;gap:0.5rem;height:calc(100vh - 57px);overflow-y:auto;position:sticky;top:57px}
        .sidebar-title{font-size:0.65rem;letter-spacing:0.12em;color:var(--accent)}
        .sidebar-sub{font-size:0.58rem;color:var(--dim)}
        .sidebar-search{background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:var(--mono);font-size:0.7rem;padding:0.4rem 0.6rem;outline:none;width:100%;transition:border-color 0.2s}
        .sidebar-search:focus{border-color:var(--accent)}
        .sidebar-search::placeholder{color:var(--border)}
        .user-list{display:flex;flex-direction:column;gap:0.3rem;flex:1;overflow-y:auto}
        .user-item{background:transparent;border:1px solid var(--border);color:var(--dim);font-family:var(--mono);font-size:0.62rem;padding:0.5rem 0.6rem;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:0.1rem;transition:all 0.15s}
        .user-item:hover{border-color:var(--accent2);color:var(--text)}
        .user-item.selected{}
        .user-item-name{font-family:var(--sans);font-weight:600;font-size:0.7rem}
        .user-item-lc{font-size:0.55rem;color:var(--dim)}
        .clear-btn{background:transparent;border:1px solid rgba(239,68,68,0.4);color:var(--danger);font-family:var(--mono);font-size:0.62rem;padding:0.4rem;cursor:pointer;transition:all 0.2s;letter-spacing:0.08em}
        .clear-btn:hover{background:rgba(239,68,68,0.1)}
        .panel{flex:1;padding:1.5rem;overflow-y:auto;display:flex;flex-direction:column;gap:1.2rem}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50vh;gap:1rem;color:var(--dim)}
        .empty-icon{font-size:3rem}
        .empty-state p{font-size:0.78rem;text-align:center;max-width:300px;line-height:1.6}
        .center-load{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:30vh}
        .spinner{width:36px;height:36px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite}
        .error-box{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);color:var(--danger);padding:0.8rem 1rem;font-size:0.75rem}
        .card{background:var(--surface);border:1px solid var(--border);padding:1.2rem}
        .card-title{font-size:0.65rem;letter-spacing:0.14em;color:var(--accent);margin-bottom:1rem}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}
        .rank-row{display:flex;align-items:center;gap:0.8rem;padding:0.5rem 0;border-bottom:1px solid var(--border)}
        .rank-row:last-child{border-bottom:none}
        .rank-pos{font-size:1rem;width:2rem}
        .rank-name{font-family:var(--sans);font-weight:600;font-size:0.85rem;width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rank-val{font-size:0.75rem;font-weight:700;color:var(--accent);width:3rem;text-align:right}
        .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
        .user-stat-card{background:var(--surface);border:1px solid var(--border);padding:1rem;border-left-width:3px}
        .user-stat-name{font-family:var(--sans);font-weight:700;font-size:0.85rem;margin-bottom:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .user-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem}
        .user-stat-grid>div{display:flex;flex-direction:column;align-items:center;gap:0.2rem}
        .us-num{font-size:1rem;font-weight:700;font-family:var(--sans)}
        .us-lbl{font-size:0.5rem;color:var(--dim);letter-spacing:0.1em}
        @media(max-width:768px){
          .layout{flex-direction:column}
          .sidebar{width:100%;height:auto;position:static;max-height:280px}
          .two-col{grid-template-columns:1fr}
        }
      `}</style>
    </>
  );
}
