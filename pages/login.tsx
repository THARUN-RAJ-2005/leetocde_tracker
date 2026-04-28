import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

type Mode = "login" | "register";

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Register-only fields
  const [name, setName] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Field-level validation errors
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.loggedIn) router.replace(d.user.isAdmin ? "/admin" : "/");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setSuccess(null);
    setEmailErr(null);
    setPasswordErr(null);
    setConfirmErr(null);
  }

  function validateFields(): boolean {
    let ok = true;

    if (!validateEmail(email)) {
      setEmailErr("Enter a valid email address.");
      ok = false;
    } else setEmailErr(null);

    if (password.length < 6) {
      setPasswordErr("Password must be at least 6 characters.");
      ok = false;
    } else setPasswordErr(null);

    if (mode === "register") {
      if (name.trim().length < 2) {
        setError("Name must be at least 2 characters.");
        ok = false;
      }
      if (password !== confirmPw) {
        setConfirmErr("Passwords do not match.");
        ok = false;
      } else setConfirmErr(null);
    }

    return ok;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validateFields()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Login failed.");
      else router.replace(data.isAdmin ? "/admin" : "/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validateFields()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
      } else {
        setSuccess("Account created! You can now sign in.");
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPw("");
        setTimeout(() => switchMode("login"), 1800);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
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

  return (
    <>
      <Head>
        <title>{mode === "login" ? "Login" : "Register"} — LC Tracker</title>
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

        <div className="center">
          <div className="card">
            {/* Logo */}
            <div className="logo-row">
              <span className="logo-bracket">[</span>
              <span className="logo-text">LC</span>
              <span className="logo-bracket">]</span>
              <span className="logo-title">Progress Tracker</span>
            </div>

            {/* Tab switcher */}
            <div className="tabs">
              <button
                className={`tab ${mode === "login" ? "tab-active" : ""}`}
                onClick={() => switchMode("login")}
                type="button"
              >
                SIGN IN
              </button>
              <button
                className={`tab ${mode === "register" ? "tab-active" : ""}`}
                onClick={() => switchMode("register")}
                type="button"
              >
                CREATE ACCOUNT
              </button>
            </div>

            {/* Flash messages */}
            {error && <div className="flash flash-error">⚠ {error}</div>}
            {success && <div className="flash flash-success">✓ {success}</div>}

            {/* ── LOGIN FORM ── */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="form" noValidate>
                <div className="field">
                  <label className="label">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    className={`input ${emailErr ? "input-err" : ""}`}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailErr(null);
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                  />
                  {emailErr && <span className="field-err">{emailErr}</span>}
                </div>

                <div className="field">
                  <label className="label">PASSWORD</label>
                  <input
                    type="password"
                    className={`input ${passwordErr ? "input-err" : ""}`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordErr(null);
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  {passwordErr && <span className="field-err">{passwordErr}</span>}
                </div>

                <button type="submit" className="btn" disabled={loading}>
                  {loading ? (
                    <span className="btn-inner">
                      <span className="btn-spinner" /> SIGNING IN...
                    </span>
                  ) : (
                    "→ SIGN IN"
                  )}
                </button>

                <p className="switch-hint">
                  No account?{" "}
                  <button type="button" className="link-btn" onClick={() => switchMode("register")}>
                    Create one here
                  </button>
                </p>
              </form>
            )}

            {/* ── REGISTER FORM ── */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="form" noValidate>
                <div className="field">
                  <label className="label">FULL NAME</label>
                  <input
                    type="text"
                    className={`input ${
                      name.trim().length > 0 && name.trim().length < 2 ? "input-err" : ""
                    }`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label className="label">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    className={`input ${emailErr ? "input-err" : ""}`}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailErr(null);
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {emailErr && <span className="field-err">{emailErr}</span>}
                </div>

                <div className="field">
                  <label className="label">
                    PASSWORD <span className="label-hint">(min. 6 characters)</span>
                  </label>
                  <input
                    type="password"
                    className={`input ${passwordErr ? "input-err" : ""}`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordErr(null);
                    }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {passwordErr && <span className="field-err">{passwordErr}</span>}
                </div>

                <div className="field">
                  <label className="label">CONFIRM PASSWORD</label>
                  <input
                    type="password"
                    className={`input ${confirmErr ? "input-err" : ""}`}
                    value={confirmPw}
                    onChange={(e) => {
                      setConfirmPw(e.target.value);
                      setConfirmErr(null);
                    }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {confirmErr && <span className="field-err">{confirmErr}</span>}
                </div>

                <button type="submit" className="btn" disabled={loading}>
                  {loading ? (
                    <span className="btn-inner">
                      <span className="btn-spinner" /> CREATING ACCOUNT...
                    </span>
                  ) : (
                    "→ CREATE ACCOUNT"
                  )}
                </button>

                <p className="switch-hint">
                  Already have an account?{" "}
                  <button type="button" className="link-btn" onClick={() => switchMode("login")}>
                    Sign in here
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
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
          --success: #22c55e;
          --mono: "Space Mono", monospace;
          --sans: "Syne", sans-serif;
        }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--mono);
          min-height: 100vh;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <style jsx>{`
        .root {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
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
        .center {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
        }

        .card {
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 2rem 2rem 2.5rem;
          position: relative;
        }
        .card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--accent2), var(--accent));
        }

        .logo-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 1.5rem;
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
        .logo-title {
          font-family: var(--sans);
          font-weight: 800;
          font-size: 1rem;
          letter-spacing: 0.04em;
          margin-left: 0.3rem;
        }

        /* Tabs */
        .tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          margin-bottom: 1.5rem;
        }
        .tab {
          flex: 1;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--dim);
          font-family: var(--mono);
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          padding: 0.5rem 0.5rem 0.6rem;
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

        /* Flash */
        .flash {
          padding: 0.6rem 0.8rem;
          font-size: 0.72rem;
          margin-bottom: 1rem;
          border-radius: 1px;
        }
        .flash-error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--danger);
        }
        .flash-success {
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: var(--success);
        }

        /* Form */
        .form {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .label {
          font-size: 0.58rem;
          letter-spacing: 0.14em;
          color: var(--accent2);
        }
        .label-hint {
          color: var(--dim);
          font-size: 0.55rem;
          letter-spacing: 0.06em;
        }

        .input {
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--mono);
          font-size: 0.85rem;
          padding: 0.65rem 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }
        .input:focus {
          border-color: var(--accent);
        }
        .input::placeholder {
          color: var(--border);
        }
        .input-err {
          border-color: rgba(239, 68, 68, 0.6) !important;
        }
        .field-err {
          font-size: 0.6rem;
          color: var(--danger);
          margin-top: 0.1rem;
        }

        .btn {
          background: transparent;
          border: 1px solid var(--accent);
          color: var(--accent);
          font-family: var(--mono);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 0.3rem;
        }
        .btn:hover:not(:disabled) {
          background: var(--accent);
          color: var(--bg);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          border-color: var(--dim);
          color: var(--dim);
        }

        .btn-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .btn-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 1.5px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .switch-hint {
          font-size: 0.62rem;
          color: var(--dim);
          text-align: center;
          margin-top: 0.5rem;
        }
        .link-btn {
          background: none;
          border: none;
          color: var(--accent2);
          font-family: var(--mono);
          font-size: 0.62rem;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
          padding: 0;
        }
        .link-btn:hover {
          color: var(--accent);
        }
      `}</style>
    </>
  );
}
