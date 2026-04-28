import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

interface LoginLog {
  id: number;
  email: string;
  logged_in_at: string;
  ip_address: string;
}

export default function LoginLogs() {
  const router = useRouter();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [search, setSearch] = useState("");

  // Admin-only guard
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.loggedIn || !d.user?.isAdmin) {
          router.replace("/login");
        } else {
          setAdminEmail(d.user.email);
          setAuthChecked(true);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login-logs");
      if (res.status === 403) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      setError("Failed to load login logs.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authChecked) fetchLogs();
  }, [authChecked, fetchLogs]);

  const filtered = logs.filter(
    (l) =>
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.ip_address?.toLowerCase().includes(search.toLowerCase())
  );

  function formatDateTime(raw: string) {
    const d = new Date(raw);
    return {
      date: d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }),
      time: d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      }),
    };
  }

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
        <div className="spinner" />
        <style jsx>{`
          .spinner {
            width: 32px;
            height: 32px;
            border: 2px solid #2a2d35;
            border-top-color: #00e5a0;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Login Logs — LC Tracker</title>
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

        {/* Header */}
        <header className="header">
          <div className="header-left">
            <span className="logo-bracket">[</span>
            <span className="logo-text">LC</span>
            <span className="logo-bracket">]</span>
            <span className="title">Login Logs</span>
            <span className="admin-badge">ADMIN</span>
          </div>
          <div className="header-right">
            <span className="admin-email">{adminEmail}</span>
            <button className="nav-btn" onClick={() => router.push("/admin")}>
              ← ADMIN
            </button>
            <button className="nav-btn" onClick={() => router.push("/")}>
              TRACKER
            </button>
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

        <main className="main">
          {error && <div className="flash-error">⚠ {error}</div>}

          {/* Stats bar */}
          <div className="stats-bar">
            <div className="stat">
              <span className="stat-val">{logs.length}</span>
              <span className="stat-label">TOTAL LOGINS</span>
            </div>
            <div className="stat">
              <span className="stat-val">{new Set(logs.map((l) => l.email)).size}</span>
              <span className="stat-label">UNIQUE USERS</span>
            </div>
            <div className="stat">
              <span className="stat-val">
                {logs.length > 0 ? formatDateTime(logs[0].logged_in_at).date : "—"}
              </span>
              <span className="stat-label">LAST LOGIN</span>
            </div>
            <button className="refresh-btn" onClick={fetchLogs} disabled={loading}>
              {loading ? "..." : "↻ REFRESH"}
            </button>
          </div>

          {/* Search */}
          <div className="search-row">
            <input
              className="search-input"
              placeholder="Search by email or IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="search-count">
              {filtered.length} of {logs.length} records
            </span>
          </div>

          {/* Table */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">LOGIN HISTORY</span>
              <span className="card-sub">// Most recent first · Last 500 entries</span>
            </div>

            {loading ? (
              <div className="list-loading">
                <div className="spinner-sm" /> Loading logs...
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <p>{search ? "No results match your search." : "No login records yet."}</p>
              </div>
            ) : (
              <div className="log-list">
                <div className="list-header">
                  <span>#</span>
                  <span>EMAIL</span>
                  <span>DATE</span>
                  <span>TIME</span>
                  <span>IP ADDRESS</span>
                </div>
                {filtered.map((log, i) => {
                  const { date, time } = formatDateTime(log.logged_in_at);
                  return (
                    <div key={log.id} className="list-row">
                      <span className="row-num">{i + 1}</span>
                      <span className="row-email">{log.email}</span>
                      <span className="row-date">{date}</span>
                      <span className="row-time">{time}</span>
                      <span className="row-ip">{log.ip_address || "—"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
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
          --danger: #ef4444;
          --mono: "Space Mono", monospace;
          --sans: "Syne", sans-serif;
        }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--mono);
          min-height: 100vh;
        }
      `}</style>

      <style jsx>{`
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
          font-size: 1.3rem;
          font-weight: 700;
        }
        .logo-text {
          color: var(--accent);
          font-size: 1rem;
          font-weight: 700;
        }
        .title {
          font-family: var(--sans);
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin-left: 0.3rem;
        }
        .admin-badge {
          font-size: 0.55rem;
          background: rgba(0, 229, 160, 0.1);
          border: 1px solid rgba(0, 229, 160, 0.3);
          color: var(--accent);
          padding: 0.15rem 0.5rem;
          letter-spacing: 0.1em;
          margin-left: 0.3rem;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          flex-wrap: wrap;
        }
        .admin-email {
          font-size: 0.65rem;
          color: var(--dim);
        }

        .nav-btn,
        .logout-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--dim);
          font-family: var(--mono);
          font-size: 0.65rem;
          padding: 0.35rem 0.8rem;
          cursor: pointer;
          letter-spacing: 0.08em;
          transition: all 0.2s;
        }
        .nav-btn:hover {
          border-color: var(--accent2);
          color: var(--accent2);
        }
        .logout-btn:hover {
          border-color: var(--danger);
          color: var(--danger);
        }

        .main {
          max-width: 960px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .flash-error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--danger);
          padding: 0.7rem 1rem;
          font-size: 0.75rem;
        }

        .stats-bar {
          display: flex;
          align-items: center;
          gap: 2rem;
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 1rem 1.5rem;
          flex-wrap: wrap;
        }
        .stat {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .stat-val {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--accent);
          font-family: var(--sans);
        }
        .stat-label {
          font-size: 0.55rem;
          color: var(--dim);
          letter-spacing: 0.1em;
        }

        .refresh-btn {
          margin-left: auto;
          background: transparent;
          border: 1px solid var(--accent);
          color: var(--accent);
          font-family: var(--mono);
          font-size: 0.68rem;
          padding: 0.4rem 1rem;
          cursor: pointer;
          letter-spacing: 0.1em;
          transition: all 0.2s;
        }
        .refresh-btn:hover:not(:disabled) {
          background: var(--accent);
          color: var(--bg);
        }
        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .search-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .search-input {
          flex: 1;
          min-width: 220px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--mono);
          font-size: 0.8rem;
          padding: 0.55rem 0.9rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .search-input:focus {
          border-color: var(--accent);
        }
        .search-input::placeholder {
          color: var(--border);
        }
        .search-count {
          font-size: 0.62rem;
          color: var(--dim);
          white-space: nowrap;
        }

        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .card-header {
          display: flex;
          align-items: baseline;
          gap: 1rem;
          padding: 1rem 1.2rem;
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
          flex-wrap: wrap;
        }
        .card-title {
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          color: var(--accent);
        }
        .card-sub {
          font-size: 0.6rem;
          color: var(--dim);
        }

        .list-loading {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 1.5rem 1.2rem;
          font-size: 0.75rem;
          color: var(--dim);
        }
        .spinner-sm {
          width: 16px;
          height: 16px;
          border: 1.5px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-state {
          padding: 2.5rem 1.2rem;
          text-align: center;
          font-size: 0.8rem;
          color: var(--dim);
        }

        .log-list {
          display: flex;
          flex-direction: column;
        }

        .list-header {
          display: grid;
          grid-template-columns: 2.5rem 1fr 8rem 7rem 9rem;
          gap: 1rem;
          padding: 0.5rem 1.2rem;
          font-size: 0.58rem;
          letter-spacing: 0.1em;
          color: var(--dim);
          background: var(--surface2);
          border-bottom: 1px solid var(--border);
        }

        .list-row {
          display: grid;
          grid-template-columns: 2.5rem 1fr 8rem 7rem 9rem;
          gap: 1rem;
          align-items: center;
          padding: 0.75rem 1.2rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
          font-size: 0.78rem;
        }
        .list-row:last-child {
          border-bottom: none;
        }
        .list-row:hover {
          background: var(--surface2);
        }

        .row-num {
          color: var(--dim);
          font-size: 0.62rem;
        }
        .row-email {
          color: var(--accent2);
          word-break: break-all;
        }
        .row-date {
          font-size: 0.68rem;
          color: var(--text);
        }
        .row-time {
          font-size: 0.68rem;
          color: var(--accent);
          font-weight: 700;
        }
        .row-ip {
          font-size: 0.62rem;
          color: var(--dim);
        }

        @media (max-width: 600px) {
          .header {
            padding: 0.8rem 1rem;
          }
          .main {
            padding: 1rem;
          }
          .list-header,
          .list-row {
            grid-template-columns: 2rem 1fr 6rem;
          }
          .list-header span:nth-child(4),
          .list-header span:nth-child(5),
          .list-row .row-time,
          .list-row .row-ip {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
