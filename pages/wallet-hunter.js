import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  return Number(n).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function fmtPct(n) {
  if (n === null || n === undefined) return "–";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function fmtUSD(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  const v = Number(n);
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeSince(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ── components ────────────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  const color =
    score >= 75 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 700,
      border: `1px solid ${color}`,
      color,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {score}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const color =
    value >= 75 ? "var(--green)" : value >= 50 ? "var(--yellow)" : "var(--accent)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 34, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

function OutcomePill({ outcome }) {
  const isYes = outcome?.toLowerCase() === "yes";
  const isNo = outcome?.toLowerCase() === "no";
  const color = isYes ? "var(--green)" : isNo ? "var(--red)" : "var(--accent2)";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.06em",
      border: `1px solid ${color}`,
      color,
    }}>
      {outcome?.toUpperCase() || "–"}
    </span>
  );
}

function StatCard({ label, value, sub, valueColor }) {
  return (
    <div style={{
      flex: "1 1 140px",
      minWidth: 140,
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "16px 18px",
      background: "var(--card)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
        opacity: 0.5,
      }} />
      <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)", marginBottom: 8, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor || "var(--text)", letterSpacing: "-0.5px" }}>
        {value}
      </div>
      {sub && <div style={{ marginTop: 4, fontSize: 11, color: "var(--dim)" }}>{sub}</div>}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

const WINDOWS = ["1d", "1w", "1m", "all"];
const REFRESH_INTERVAL = 30; // seconds

export default function WalletHunter() {
  const [window, setWindow] = useState("1w");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [activeTab, setActiveTab] = useState("signals"); // "signals" | "wallets"
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  const scan = useCallback(async (win) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/polymarket/scan?window=${win || window}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Scan failed");
      setData(json);
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, [window]);

  // Initial load + auto-refresh
  useEffect(() => {
    scan(window);

    timerRef.current = setInterval(() => scan(window), REFRESH_INTERVAL * 1000);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL : c - 1));
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [window]);

  function handleWindowChange(w) {
    clearInterval(timerRef.current);
    clearInterval(countdownRef.current);
    setWindow(w);
  }

  return (
    <>
      <Head>
        <title>Wallet Hunter · Polymarket</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </Head>

      <style>{`
        :root {
          --bg: #06090f;
          --card: #0b1119;
          --border: #18253a;
          --accent: #7c5cff;
          --accent2: #00d4ff;
          --green: #00e5a0;
          --red: #ff4d6a;
          --yellow: #ffb800;
          --text: #ccd9f0;
          --dim: #3d5070;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100vh;
          line-height: 1.5;
        }
        body::before {
          content: '';
          position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 10% -5%, rgba(124,92,255,.07) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(0,212,255,.05) 0%, transparent 60%);
          pointer-events: none; z-index: 0;
        }
        button { cursor: pointer; border: none; font-family: inherit; }
        button:disabled { cursor: not-allowed; opacity: .5; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .tab-btn {
          padding: 7px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: all .2s;
          background: transparent;
          color: var(--dim);
          border: 1px solid transparent;
        }
        .tab-btn.active {
          background: rgba(124,92,255,.15);
          border-color: rgba(124,92,255,.4);
          color: var(--accent);
        }
        .tab-btn:hover:not(.active) { color: var(--text); }
        .win-btn {
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          transition: all .15s;
          background: transparent;
          color: var(--dim);
          border: 1px solid var(--border);
        }
        .win-btn.active {
          background: rgba(0,212,255,.12);
          border-color: rgba(0,212,255,.4);
          color: var(--accent2);
        }
        .win-btn:hover:not(.active) { color: var(--text); border-color: var(--dim); }
        .signal-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--card);
          padding: 18px 20px;
          transition: border-color .2s;
        }
        .signal-card:hover { border-color: rgba(124,92,255,.35); }
        tr:hover td { background: rgba(255,255,255,0.02); }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* ── header ── */}
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 13,
                background: "linear-gradient(135deg, #7c5cff, #00d4ff)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, boxShadow: "0 0 24px rgba(124,92,255,.4)",
              }}>
                🎯
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.5px" }}>
                  Wallet Hunter
                </h1>
                <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 1 }}>
                  Polymarket whale convergence detector
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Window selector */}
              <div style={{ display: "flex", gap: 4 }}>
                {WINDOWS.map((w) => (
                  <button
                    key={w}
                    className={`win-btn${window === w ? " active" : ""}`}
                    onClick={() => handleWindowChange(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>

              {/* Refresh button */}
              <button
                onClick={() => scan(window)}
                disabled={loading}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 16px",
                  borderRadius: 8,
                  background: loading ? "var(--border)" : "linear-gradient(135deg, var(--accent), #5a3fd4)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: loading ? "none" : "0 4px 16px rgba(124,92,255,.3)",
                  transition: "all .2s",
                }}
              >
                <span style={{ fontSize: loading ? 14 : 16 }}>{loading ? "⏳" : "⟳"}</span>
                {loading ? "Scanning…" : `Refresh (${countdown}s)`}
              </button>
            </div>
          </div>

          {/* status bar */}
          {data && (
            <div style={{
              marginTop: 16,
              display: "flex", gap: 20, flexWrap: "wrap",
              fontSize: 12, color: "var(--dim)",
            }}>
              <span>Wallets scanned: <strong style={{ color: "var(--text)" }}>{data.meta?.walletsScanned ?? 0}</strong></span>
              <span>Signals found: <strong style={{ color: "var(--accent2)" }}>{data.meta?.signalsFound ?? 0}</strong></span>
              <span>Window: <strong style={{ color: "var(--text)" }}>{data.meta?.window}</strong></span>
              <span>Updated: <strong style={{ color: "var(--text)" }}>{timeSince(data.scannedAt)}</strong></span>
            </div>
          )}
        </header>

        {/* ── error ── */}
        {error && (
          <div style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(255,77,106,.08)",
            border: "1px solid rgba(255,77,106,.25)",
            color: "var(--red)",
            marginBottom: 20,
            fontSize: 13,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ── summary cards ── */}
        {data && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
            <StatCard
              label="Top Wallets"
              value={data.wallets?.length ?? 0}
              sub={`window: ${data.meta?.window}`}
            />
            <StatCard
              label="Active Signals"
              value={data.signals?.length ?? 0}
              valueColor={data.signals?.length > 0 ? "var(--green)" : "var(--dim)"}
              sub="convergence events"
            />
            <StatCard
              label="Strongest Signal"
              value={data.signals?.[0] ? `${data.signals[0].confidence}%` : "–"}
              valueColor="var(--yellow)"
              sub={data.signals?.[0]?.outcome ? `${data.signals[0].outcome} · ${data.signals[0].walletCount} whales` : "no signals yet"}
            />
            <StatCard
              label="Auto-refresh"
              value={`${countdown}s`}
              sub="every 30 seconds"
            />
          </div>
        )}

        {/* ── tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button className={`tab-btn${activeTab === "signals" ? " active" : ""}`} onClick={() => setActiveTab("signals")}>
            Convergence Signals {data?.signals?.length ? `(${data.signals.length})` : ""}
          </button>
          <button className={`tab-btn${activeTab === "wallets" ? " active" : ""}`} onClick={() => setActiveTab("wallets")}>
            Whale Wallets {data?.wallets?.length ? `(${data.wallets.length})` : ""}
          </button>
        </div>

        {/* ── loading placeholder ── */}
        {loading && !data && (
          <div style={{
            padding: "60px 20px",
            textAlign: "center",
            color: "var(--dim)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            background: "var(--card)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 15, marginBottom: 6 }}>Scanning {TOP_WALLET_COUNT} whale wallets…</div>
            <div style={{ fontSize: 13 }}>Detecting convergence signals on Polymarket</div>
          </div>
        )}

        {/* ── SIGNALS TAB ── */}
        {activeTab === "signals" && data && (
          <>
            {data.signals?.length === 0 && (
              <div style={{
                padding: "48px 20px",
                textAlign: "center",
                color: "var(--dim)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                background: "var(--card)",
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 15, marginBottom: 6 }}>No convergence signals detected</div>
                <div style={{ fontSize: 13 }}>
                  Need ≥3 top wallets betting the same outcome simultaneously
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.signals?.map((sig, i) => (
                <div key={`${sig.conditionId}-${sig.outcome}-${i}`} className="signal-card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          padding: "2px 8px", borderRadius: 4,
                          background: i === 0 ? "rgba(255,184,0,.15)" : "rgba(124,92,255,.1)",
                          color: i === 0 ? "var(--yellow)" : "var(--dim)",
                          border: `1px solid ${i === 0 ? "rgba(255,184,0,.3)" : "var(--border)"}`,
                        }}>
                          {i === 0 ? "🔥 TOP SIGNAL" : `#${i + 1}`}
                        </span>
                        <OutcomePill outcome={sig.outcome} />
                        <span style={{ fontSize: 12, color: "var(--dim)" }}>
                          {sig.walletCount} whales · avg score {sig.avgScore}
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>
                        {sig.title || sig.conditionId}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>Confidence</div>
                      <ConfidenceBar value={sig.confidence} />
                      {sig.avgPrice != null && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "var(--dim)" }}>
                          avg entry: <span style={{ color: "var(--text)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {(sig.avgPrice * 100).toFixed(1)}¢
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Whale list */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {sig.wallets.map((w) => (
                      <div key={w.address} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        fontSize: 12,
                      }}>
                        <ScoreBadge score={w.score} />
                        <span style={{ color: "var(--dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {w.name || shortAddr(w.address)}
                        </span>
                        {w.avgPrice != null && (
                          <span style={{ color: "var(--accent2)" }}>
                            @{(w.avgPrice * 100).toFixed(1)}¢
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── WALLETS TAB ── */}
        {activeTab === "wallets" && data && (
          <div style={{
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--card)",
            overflow: "hidden",
          }}>
            {data.wallets?.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
                No wallet data available
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{
                      background: "rgba(255,255,255,0.025)",
                      fontSize: 10,
                      color: "var(--dim)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}>
                      {["Rank", "Wallet", "Score", "Win Rate", "Profit", "Trades", "Open Pos."].map((h, i) => (
                        <th key={h} style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid var(--border)",
                          textAlign: i >= 2 ? "right" : "left",
                          whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.wallets.sort((a, b) => b.score - a.score).map((w, i) => (
                      <tr key={w.address} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(24,37,58,.7)", fontSize: 13 }}>
                        <td style={{ padding: "11px 16px", color: "var(--dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--accent2)" }}>
                            {w.name || shortAddr(w.address)}
                          </div>
                          {w.name && (
                            <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                              {shortAddr(w.address)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "11px 16px", textAlign: "right" }}>
                          <ScoreBadge score={w.score} />
                        </td>
                        <td style={{
                          padding: "11px 16px",
                          textAlign: "right",
                          fontFamily: "'JetBrains Mono', monospace",
                          color: w.winRate >= 0.6 ? "var(--green)" : w.winRate >= 0.4 ? "var(--text)" : "var(--red)",
                        }}>
                          {fmtPct(w.winRate)}
                        </td>
                        <td style={{
                          padding: "11px 16px",
                          textAlign: "right",
                          fontFamily: "'JetBrains Mono', monospace",
                          color: w.profit > 0 ? "var(--green)" : w.profit < 0 ? "var(--red)" : "var(--text)",
                        }}>
                          {fmtUSD(w.profit)}
                        </td>
                        <td style={{ padding: "11px 16px", textAlign: "right", color: "var(--dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {fmt(w.tradesCount, 0)}
                        </td>
                        <td style={{ padding: "11px 16px", textAlign: "right", color: "var(--accent2)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {w.openPositions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── how it works ── */}
        <div style={{
          marginTop: 40,
          padding: "20px 24px",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "rgba(124,92,255,0.04)",
          fontSize: 13,
          color: "var(--dim)",
          lineHeight: 1.7,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10 }}>
            How It Works
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 24px" }}>
            <div><span style={{ color: "var(--text)" }}>①</span> Fetches top wallets from Polymarket's leaderboard</div>
            <div><span style={{ color: "var(--text)" }}>②</span> Scores each wallet: win rate × profit × activity</div>
            <div><span style={{ color: "var(--text)" }}>③</span> Fetches open positions for every tracked wallet</div>
            <div><span style={{ color: "var(--text)" }}>④</span> Detects markets where ≥3 top wallets are on the same side</div>
            <div><span style={{ color: "var(--text)" }}>⑤</span> Calculates confidence score from wallet count + scores + win rates</div>
            <div><span style={{ color: "var(--text)" }}>⑥</span> Auto-refreshes every 30 seconds</div>
          </div>
        </div>

        {/* ── footer ── */}
        <footer style={{ marginTop: 40, textAlign: "center", fontSize: 12, color: "var(--dim)" }}>
          Data: Polymarket public API · Not financial advice · Past signals do not guarantee future results
        </footer>
      </div>
    </>
  );
}

// constant referenced in loading placeholder
const TOP_WALLET_COUNT = 50;
