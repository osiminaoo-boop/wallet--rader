import { useMemo, useState } from "react";
import Head from "next/head";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n, digits = 4) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  return Number(n).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function solscanTx(txId) {
  return `https://solscan.io/tx/${txId}`;
}

// ── components ────────────────────────────────────────────────────────────────

function StatCard({ label, value, valueColor, sub }) {
  return (
    <div style={{
      flex: "1 1 160px",
      minWidth: 160,
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "18px 20px",
      background: "var(--card)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
        opacity: 0.5,
      }} />
      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--dim)", marginBottom: 10, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: valueColor || "var(--text)", letterSpacing: "-0.5px" }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--dim)" }}>{sub}</div>
      )}
    </div>
  );
}

function Badge({ type }) {
  const map = {
    buy: { label: "BUY", color: "var(--green)" },
    sell: { label: "SELL", color: "var(--red)" },
    other: { label: "OTHER", color: "var(--dim)" },
  };
  const cfg = map[type] || map.other;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      border: `1px solid ${cfg.color}`,
      color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [mint, setMint] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const summary = useMemo(() => result?.summary || null, [result]);

  const pnlColor = useMemo(() => {
    if (!summary) return "var(--text)";
    return summary.realizedPnlSol > 0 ? "var(--green)" : summary.realizedPnlSol < 0 ? "var(--red)" : "var(--text)";
  }, [summary]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/pnl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: wallet.trim(), mint: mint.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "計算に失敗しました");
      setResult(data);
    } catch (err) {
      setError(err.message || "不明なエラー");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>universeX PnL Calculator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </Head>

      <style>{`
        :root {
          --bg: #070b14;
          --card: #0d1220;
          --border: #1a2540;
          --accent: #7c5cff;
          --accent2: #00d4ff;
          --green: #00e5a0;
          --red: #ff4d6a;
          --text: #d4dff5;
          --dim: #4a5a7a;
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
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% -10%, rgba(124,92,255,.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 110%, rgba(0,212,255,.06) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }
        input {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          background: rgba(255,255,255,0.04);
          color: var(--accent2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0 14px;
          height: 46px;
          width: 100%;
          outline: none;
          transition: border-color .2s, box-shadow .2s;
        }
        input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(124,92,255,.15);
        }
        input::placeholder { color: var(--dim); }
        button {
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          letter-spacing: .03em;
          transition: all .2s;
        }
        button:disabled { cursor: not-allowed; opacity: .5; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* ── header ── */}
        <header style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: "0 0 20px rgba(124,92,255,.4)",
            }}>
              ◎
            </div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.5px" }}>
                universeX PnL Calculator
              </h1>
              <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 2 }}>
                universeXで取引したコインの損益を計算 · Powered by Solscan
              </p>
            </div>
          </div>

          {/* info banner */}
          <div style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(0,212,255,.06)",
            border: "1px solid rgba(0,212,255,.15)",
            fontSize: 13,
            color: "var(--accent2)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 16 }}>ℹ</span>
            <span>
              universeXは別のウォレットを介してトレードするため、gmgnでは表示されません。
              このツールはSolscanの残高変化データを使ってウォレットとコインCAから直接損益を計算します。
            </span>
          </div>
        </header>

        {/* ── form ── */}
        <form onSubmit={onSubmit} style={{
          padding: "24px",
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--card)",
          marginBottom: 24,
        }}>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
            <label>
              <div style={{ fontSize: 12, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Wallet Address
              </div>
              <input
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="Solanaウォレットアドレス"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label>
              <div style={{ fontSize: 12, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Token CA (Mint address)
              </div>
              <input
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="トークンのコントラクトアドレス"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
          </div>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={loading || !wallet.trim() || !mint.trim()}
              style={{
                height: 46,
                padding: "0 28px",
                background: loading
                  ? "var(--border)"
                  : "linear-gradient(135deg, var(--accent), #5a3fd4)",
                color: "white",
                fontSize: 14,
                boxShadow: loading ? "none" : "0 4px 20px rgba(124,92,255,.35)",
              }}
            >
              {loading ? "⏳ 計算中..." : "◎  損益を計算する"}
            </button>
          </div>
        </form>

        {/* ── error ── */}
        {error && (
          <div style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(255,77,106,.08)",
            border: "1px solid rgba(255,77,106,.3)",
            color: "var(--red)",
            marginBottom: 20,
            fontSize: 14,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ── results ── */}
        {summary && result && (
          <>
            {/* wallet / mint info */}
            <div style={{
              marginBottom: 20,
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
              color: "var(--dim)",
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
            }}>
              <span>Wallet: <code style={{ color: "var(--text)", fontFamily: "'JetBrains Mono', monospace" }}>{shortAddr(result.wallet)}</code></span>
              <span>Token: <code style={{ color: "var(--text)", fontFamily: "'JetBrains Mono', monospace" }}>{shortAddr(result.mint)}</code></span>
              <span>取引数: <strong style={{ color: "var(--text)" }}>{summary.analyzedTxCount}</strong></span>
              <span>データ件数: <strong style={{ color: "var(--text)" }}>{summary.tokenActivities}</strong></span>
            </div>

            {/* stat cards */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <StatCard
                label="実現損益 (SOL)"
                value={`${summary.realizedPnlSol >= 0 ? "+" : ""}${fmt(summary.realizedPnlSol, 6)} SOL`}
                valueColor={pnlColor}
              />
              <StatCard
                label="総購入額 (SOL)"
                value={`${fmt(summary.totalBuySol, 6)} SOL`}
                sub={`${fmt(summary.totalBoughtTokens, 2)} tokens`}
              />
              <StatCard
                label="総売却額 (SOL)"
                value={`${fmt(summary.totalSellSol, 6)} SOL`}
                sub={`${fmt(summary.totalSoldTokens, 2)} tokens`}
              />
              <StatCard
                label="未決済残高"
                value={fmt(summary.openPositionTokens, 4)}
                sub={`コスト基準: ${fmt(summary.openCostBasisSol, 6)} SOL`}
              />
              <StatCard
                label="手数料 (推計)"
                value={`${fmt(summary.reportedFeesSol, 6)} SOL`}
              />
            </div>

            {/* profit breakdown bar */}
            {(summary.totalBuySol > 0 || summary.totalSellSol > 0) && (
              <div style={{
                padding: "16px 20px",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--card)",
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                  損益サマリ
                </div>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>購入 (IN)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--red)" }}>
                      -{fmt(summary.totalBuySol, 6)} SOL
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: 20, color: "var(--dim)" }}>→</div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>売却 (OUT)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>
                      +{fmt(summary.totalSellSol, 6)} SOL
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: 20, color: "var(--dim)" }}>=</div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>実現損益</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: pnlColor }}>
                      {summary.realizedPnlSol >= 0 ? "+" : ""}{fmt(summary.realizedPnlSol, 6)} SOL
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* warnings */}
            {summary.warnings?.length > 0 && (
              <div style={{
                marginBottom: 20,
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(255,184,0,.06)",
                border: "1px solid rgba(255,184,0,.2)",
                fontSize: 13,
                color: "#ffb800",
              }}>
                {summary.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}

            {/* trade table */}
            {result.trades?.length > 0 && (
              <div style={{
                borderRadius: 16,
                border: "1px solid var(--border)",
                background: "var(--card)",
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--dim)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span>取引履歴</span>
                  <span>{result.trades.length} 件</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr style={{
                        background: "rgba(255,255,255,0.02)",
                        fontSize: 11,
                        color: "var(--dim)",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}>
                        <th style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>日時</th>
                        <th style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>種別</th>
                        <th style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>トークン数量</th>
                        <th style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>SOL</th>
                        <th style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>実現損益</th>
                        <th style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr
                          key={t.txId}
                          style={{
                            borderTop: i === 0 ? "none" : "1px solid rgba(26,37,64,.6)",
                            fontSize: 13,
                          }}
                        >
                          <td style={{ padding: "12px 16px", color: "var(--dim)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                            {new Date(t.blockTime * 1000).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <Badge type={t.type} />
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                            {fmt(t.tokenAmount, 4)}
                          </td>
                          <td style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontFamily: "'JetBrains Mono', monospace",
                            color: t.type === "buy" ? "var(--red)" : t.type === "sell" ? "var(--green)" : "var(--text)",
                          }}>
                            {t.type === "buy" ? "-" : t.type === "sell" ? "+" : ""}{fmt(t.solAmount, 6)}
                          </td>
                          <td style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontFamily: "'JetBrains Mono', monospace",
                            color: t.realizedPnlSol == null
                              ? "var(--dim)"
                              : t.realizedPnlSol >= 0 ? "var(--green)" : "var(--red)",
                          }}>
                            {t.realizedPnlSol == null
                              ? "–"
                              : `${t.realizedPnlSol >= 0 ? "+" : ""}${fmt(t.realizedPnlSol, 6)}`}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <a
                              href={solscanTx(t.txId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--accent)" }}
                            >
                              {t.txId.slice(0, 8)}…
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.trades?.length === 0 && (
              <div style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "var(--dim)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                background: "var(--card)",
              }}>
                このウォレット × トークンCAの組み合わせで取引が見つかりませんでした。
                <br />
                <span style={{ fontSize: 13, marginTop: 8, display: "block" }}>
                  ウォレットアドレスまたはトークンCAをご確認ください。
                </span>
              </div>
            )}
          </>
        )}

        {/* ── footer ── */}
        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 12, color: "var(--dim)" }}>
          データソース: Solscan Pro API · universeX取引はSolscan残高変化データから算出
        </footer>
      </div>
    </>
  );
}
