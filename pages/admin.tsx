import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

interface AllowedEmail {
  id: number;
  name: string | null;
  email: string;
  created_at: string;
}

export default function Admin() {
  const router = useRouter();
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  // Auth guard
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

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/emails");
      if (res.status === 403) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setEmails(data.emails || []);
    } catch {
      setError("Failed to load emails.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authChecked) fetchEmails();
  }, [authChecked, fetchEmails]);

  function flash(msg: string, isError = false) {
    if (isError) {
      setError(msg);
      setSuccess(null);
    } else {
      setSuccess(msg);
      setError(null);
    }
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 3500);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email || !email.includes("@")) return flash("Enter a valid email.", true);
    setAdding(true);
    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "Failed to add.", true);
      setNewEmail("");
      flash(`✓ ${email} added successfully.`);
      fetchEmails();
    } catch {
      flash("Network error.", true);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: number, email: string) {
    if (!confirm(`Remove ${email} from the whitelist?`)) return;
    setRemovingId(id);
    try {
      const res = await fetch("/api/admin/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "Failed to remove.", true);
      flash(`✓ ${email} removed.`);
      fetchEmails();
    } catch {
      flash("Network error.", true);
    } finally {
      setRemovingId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
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
        <title>Admin — LC Tracker</title>
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
            <span className="title">Admin Panel</span>
            <span className="admin-badge">ADMIN</span>
          </div>
          <div className="header-right">
            <span className="admin-email">{adminEmail}</span>
            <button className="nav-btn" onClick={() => router.push("/")}>
              ← TRACKER
            </button>
            <button className="nav-btn" onClick={() => router.push("/login-logs")}>
              📋 LOGIN LOGS
            </button>
            <button className="nav-btn" onClick={() => router.push("/analytics")}>
              📊 ANALYTICS
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        </header>

        <main className="main">
          {/* Flash messages */}
          {error && <div className="flash flash-error">⚠ {error}</div>}
          {success && <div className="flash flash-success">✓ {success}</div>}

          {/* Section: Add Email */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">ADD AUTHORISED EMAIL</span>
              <span className="card-sub">// Users with these emails can access the tracker</span>
            </div>
            <form onSubmit={handleAdd} className="add-form">
              <input
                type="email"
                className="input"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={adding}
                autoComplete="off"
              />
              <button type="submit" className="add-btn" disabled={adding}>
                {adding ? (
                  <span className="btn-inner">
                    <span className="btn-spinner" /> ADDING...
                  </span>
                ) : (
                  "+ ADD EMAIL"
                )}
              </button>
            </form>
          </section>

          {/* Section: Email List */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">AUTHORISED EMAILS</span>
              <span className="card-count">
                {emails.length} record{emails.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="list-loading">
                <div className="spinner-sm" /> Loading...
              </div>
            ) : emails.length === 0 ? (
              <div className="empty-state">
                <p>No authorised emails yet.</p>
                <p className="dim">Add an email above to grant access.</p>
              </div>
            ) : (
              <div className="email-list">
                <div className="list-header">
                  <span>#</span>
                  <span>NAME</span>
                  <span>EMAIL ADDRESS</span>
                  <span>JOINED</span>
                  <span>ACTION</span>
                </div>
                {emails.map((e, i) => (
                  <div key={e.id} className="list-row">
                    <span className="row-num">{i + 1}</span>
                    <span className="row-name">{e.name || "—"}</span>
                    <span className="row-email">{e.email}</span>
                    <span className="row-date">
                      {new Date(e.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>
                      <button
                        className="remove-btn"
                        onClick={() => handleRemove(e.id, e.email)}
                        disabled={removingId === e.id}
                      >
                        {removingId === e.id ? "..." : "✕ REMOVE"}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Info box */}
          <div className="info-box">
            <p>
              <span className="info-label">HOW IT WORKS</span>
            </p>
            <p>
              Only emails on this list can log in to the tracker. The admin account (
              <span className="accent">{adminEmail}</span>) always has full access and cannot be
              removed here.
            </p>
          </div>
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
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          );
          z-index: 100;
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
          max-width: 760px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .flash {
          padding: 0.7rem 1rem;
          font-size: 0.75rem;
          border-radius: 1px;
        }
        .flash-error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--danger);
        }
        .flash-success {
          background: rgba(0, 229, 160, 0.08);
          border: 1px solid rgba(0, 229, 160, 0.3);
          color: var(--accent);
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
        .card-count {
          font-size: 0.6rem;
          color: var(--dim);
          margin-left: auto;
        }

        .add-form {
          display: flex;
          gap: 0.8rem;
          padding: 1.2rem;
          flex-wrap: wrap;
        }

        .input {
          flex: 1;
          min-width: 200px;
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--mono);
          font-size: 0.85rem;
          padding: 0.6rem 0.9rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .input:focus {
          border-color: var(--accent);
        }
        .input::placeholder {
          color: var(--border);
        }
        .input:disabled {
          opacity: 0.5;
        }

        .add-btn {
          background: transparent;
          border: 1px solid var(--accent);
          color: var(--accent);
          font-family: var(--mono);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          padding: 0.6rem 1.2rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .add-btn:hover:not(:disabled) {
          background: var(--accent);
          color: var(--bg);
        }
        .add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          border-color: var(--dim);
          color: var(--dim);
        }

        .btn-inner {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .btn-spinner {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 1.5px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
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

        .empty-state {
          padding: 2.5rem 1.2rem;
          text-align: center;
          font-size: 0.8rem;
          color: var(--dim);
        }
        .empty-state p + p {
          margin-top: 0.3rem;
          font-size: 0.65rem;
        }
        .dim {
          color: var(--border);
        }

        .email-list {
          display: flex;
          flex-direction: column;
        }

        .list-header {
          display: grid;
          grid-template-columns: 2rem 6rem 1fr 7rem 6rem;
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
          grid-template-columns: 2rem 6rem 1fr 7rem 6rem;
          gap: 1rem;
          align-items: center;
          padding: 0.75rem 1.2rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
          font-size: 0.8rem;
        }
        .list-row:last-child {
          border-bottom: none;
        }
        .list-row:hover {
          background: var(--surface2);
        }

        .row-name {
          font-size: 0.78rem;
          color: var(--accent2);
          font-family: var(--sans);
          font-weight: 600;
        }
        
        .row-num {
          color: var(--dim);
          font-size: 0.65rem;
        }
        .row-email {
          color: var(--text);
          word-break: break-all;
        }
        .row-date {
          font-size: 0.62rem;
          color: var(--dim);
        }

        .remove-btn {
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--danger);
          font-family: var(--mono);
          font-size: 0.58rem;
          letter-spacing: 0.08em;
          padding: 0.3rem 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .remove-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
          border-color: var(--danger);
        }
        .remove-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .info-box {
          border: 1px solid var(--border);
          padding: 1rem 1.2rem;
          background: var(--surface);
          font-size: 0.68rem;
          color: var(--dim);
          line-height: 1.7;
        }
        .info-label {
          font-size: 0.58rem;
          letter-spacing: 0.12em;
          color: var(--accent2);
          display: block;
          margin-bottom: 0.4rem;
        }
        .accent {
          color: var(--accent);
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
            grid-template-columns: 1.5rem 1fr 5rem;
          }
          .list-header span:nth-child(3),
          .list-row .row-date {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
