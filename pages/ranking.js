import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

// ── helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function fmtPrice(n) {
  if (!n && n !== 0) return "–";
  if (n < 0.000001) return n.toExponential(2);
  if (n < 0.01) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtMcap(n) {
  if (!n && n !== 0) return "–";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "–";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtDate(iso) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function medalEmoji(rank) {
  if (rank === 0) return "🥇";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return `#${rank + 1}`;
}

// ── styles ────────────────────────────────────────────────────────────────────

const CSS = `
  :root {
    --bg: #070b14;
    --card: #0d1220;
    --card2: #111827;
    --border: #1a2540;
    --accent: #7c5cff;
    --accent2: #00d4ff;
    --green: #00e5a0;
    --red: #ff4d6a;
    --yellow: #ffd166;
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
  input, textarea, select {
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
  textarea { height: auto; padding: 12px 14px; resize: vertical; }
  input:focus, textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(124,92,255,.15);
  }
  input::placeholder, textarea::placeholder { color: var(--dim); font-family: 'Inter', sans-serif; }
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
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; }
  .tab-btn {
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    background: transparent;
    color: var(--dim);
    border: 1px solid transparent;
  }
  .tab-btn.active {
    background: rgba(124,92,255,.15);
    color: var(--text);
    border-color: rgba(124,92,255,.3);
  }
  .tab-btn:hover:not(.active) { color: var(--text); }
`;

// ── sub-components ────────────────────────────────────────────────────────────

function PctBadge({ value }) {
  if (value == null || isNaN(value)) return <span style={{ color: "var(--dim)" }}>–</span>;
  const color = value > 0 ? "var(--green)" : value < 0 ? "var(--red)" : "var(--dim)";
  return <span style={{ color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtPct(value)}</span>;
}

function ScoreBadge({ score }) {
  if (score == null || isNaN(score)) return <span style={{ color: "var(--dim)" }}>–</span>;
  const color = score > 50 ? "var(--green)" : score > 0 ? "var(--accent2)" : score < 0 ? "var(--red)" : "var(--dim)";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      color,
    }}>
      {fmtPct(score)}
    </span>
  );
}

// ── RegisterForm ──────────────────────────────────────────────────────────────

function RegisterForm({ onRegistered }) {
  const [submitter, setSubmitter] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ranking/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submitter, tokenAddress, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "登録に失敗しました");
      setSuccess(data.coin);
      setTokenAddress("");
      setComment("");
      onRegistered?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      padding: 24,
      borderRadius: 18,
      border: "1px solid var(--border)",
      background: "var(--card)",
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 18 }}>
        コインを登録する
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 2fr" }}>
          <label>
            <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>ニックネーム</div>
            <input
              value={submitter}
              onChange={(e) => setSubmitter(e.target.value)}
              placeholder="あなたの名前"
              spellCheck={false}
              autoComplete="off"
              style={{ fontFamily: "'Inter', sans-serif", color: "var(--text)" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>トークン CA (Solana アドレス)</div>
            <input
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="トークンのコントラクトアドレス"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>コメント (任意)</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="このコインを推す理由など..."
            rows={2}
          />
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={loading || !submitter.trim() || !tokenAddress.trim()}
            style={{
              height: 46,
              padding: "0 28px",
              background: loading ? "var(--border)" : "linear-gradient(135deg, var(--accent), #5a3fd4)",
              color: "white",
              fontSize: 14,
              boxShadow: loading ? "none" : "0 4px 20px rgba(124,92,255,.35)",
            }}
          >
            {loading ? "⏳ 登録中..." : "◎  コインを登録する"}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(255,77,106,.08)", border: "1px solid rgba(255,77,106,.3)", color: "var(--red)", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {success && (
        <div style={{ marginTop: 14, padding: "14px 18px", borderRadius: 12, background: "rgba(0,229,160,.06)", border: "1px solid rgba(0,229,160,.2)", fontSize: 13 }}>
          <div style={{ color: "var(--green)", fontWeight: 700, marginBottom: 6 }}>✓ 登録しました！</div>
          <div style={{ color: "var(--text)" }}>
            <strong>{success.tokenSymbol}</strong> ({success.tokenName}) を登録しました。
            登録価格: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--accent2)" }}>${fmtPrice(success.registeredPrice)}</span>
            {success.registeredMcap > 0 && <>　時価総額: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--accent2)" }}>{fmtMcap(success.registeredMcap)}</span></>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── UserRankings ──────────────────────────────────────────────────────────────

function UserRankings({ rankings }) {
  if (!rankings?.length) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
        まだ登録されたコインはありません
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--card)", overflow: "hidden" }}>
      <table>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.02)", fontSize: 11, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>順位</th>
            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>ニックネーム</th>
            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>ベストスコア</th>
            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>平均スコア</th>
            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>登録数</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((user, i) => (
            <tr key={user.submitter} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(26,37,64,.6)" }}>
              <td style={{ padding: "14px 16px", fontSize: 18, fontWeight: 700 }}>{medalEmoji(i)}</td>
              <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15, color: "var(--text)" }}>
                {user.submitter}
              </td>
              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                <ScoreBadge score={user.bestScore} />
              </td>
              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                <PctBadge value={user.avgScore} />
              </td>
              <td style={{ padding: "14px 16px", textAlign: "right", color: "var(--dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                {user.totalCoins}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── CoinList ──────────────────────────────────────────────────────────────────

function CoinList({ coins }) {
  if (!coins?.length) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
        まだ登録されたコインはありません
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--card)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.02)", fontSize: 11, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>#</th>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>コイン</th>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>紹介者</th>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>登録時 時価総額</th>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>最高 時価総額 (ATH)</th>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>ATH 達成日時</th>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>現在 時価総額</th>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>スコア (ATH上昇率)</th>
              <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>登録日時</th>
            </tr>
          </thead>
          <tbody>
            {coins.map((coin, i) => (
              <tr key={coin.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(26,37,64,.6)", fontSize: 13 }}>
                <td style={{ padding: "12px 16px", color: "var(--dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {medalEmoji(i)}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{coin.tokenSymbol}</div>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                    {coin.dexUrl ? (
                      <a href={coin.dexUrl} target="_blank" rel="noopener noreferrer">
                        {shortAddr(coin.tokenAddress)}
                      </a>
                    ) : (
                      shortAddr(coin.tokenAddress)
                    )}
                  </div>
                  {coin.comment && (
                    <div style={{ fontSize: 11, color: "var(--accent2)", marginTop: 3, fontStyle: "italic", fontFamily: "'Inter', sans-serif" }}>
                      "{coin.comment}"
                    </div>
                  )}
                </td>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--accent)" }}>
                  {coin.submitter}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--dim)", fontSize: 12 }}>
                  {fmtMcap(coin.registeredMcap)}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--yellow)", fontWeight: 700, fontSize: 12 }}>
                    {fmtMcap(coin.peakMcap)}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--dim)", fontSize: 11, whiteSpace: "nowrap" }}>
                  {fmtDate(coin.peakMcapAt)}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--text)", fontSize: 12 }}>
                  {fmtMcap(coin.currentMcap)}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <ScoreBadge score={coin.score} />
                </td>
                <td style={{ padding: "12px 16px", color: "var(--dim)", fontSize: 11, whiteSpace: "nowrap" }}>
                  {fmtDate(coin.registeredAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function RankingPage() {
  const [tab, setTab] = useState("rankings");
  const [coins, setCoins] = useState([]);
  const [userRankings, setUserRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ranking/coins");
      const data = await res.json();
      setCoins(data.coins ?? []);
      setUserRankings(data.userRankings ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPrices = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ranking/refresh", { method: "POST" });
      const data = await res.json();
      if (data.coins) {
        const sorted = [...data.coins].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        setCoins(sorted);
        // recompute user rankings
        const userMap = {};
        for (const coin of data.coins) {
          const s = coin.submitter;
          if (!userMap[s]) userMap[s] = { submitter: s, coins: [], bestScore: -Infinity, totalCoins: 0 };
          userMap[s].coins.push(coin);
          userMap[s].totalCoins++;
          if ((coin.score ?? 0) > userMap[s].bestScore) userMap[s].bestScore = coin.score ?? 0;
        }
        const rankings = Object.values(userMap)
          .map((u) => ({ ...u, avgScore: u.coins.reduce((s, c) => s + (c.score ?? 0), 0) / u.coins.length }))
          .sort((a, b) => b.bestScore - a.bestScore);
        setUserRankings(rankings);
      }
      setLastRefreshed(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      <Head>
        <title>Solana Meme Coin Ranking</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" />
      </Head>

      <style>{CSS}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* header */}
        <header style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, boxShadow: "0 0 20px rgba(124,92,255,.4)",
              }}>
                🏆
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.5px" }}>
                  Solana Meme Coin Ranking
                </h1>
                <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 2 }}>
                  コインを登録して、センスを競おう · スコア = 登録時からの最高時価総額（ATH）上昇率
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {lastRefreshed && (
                <span style={{ fontSize: 11, color: "var(--dim)" }}>
                  最終更新: {lastRefreshed.toLocaleTimeString("ja-JP")}
                </span>
              )}
              <button
                onClick={refreshPrices}
                disabled={refreshing}
                style={{
                  height: 38,
                  padding: "0 18px",
                  background: "rgba(0,212,255,.1)",
                  color: "var(--accent2)",
                  border: "1px solid rgba(0,212,255,.2)",
                  fontSize: 13,
                }}
              >
                {refreshing ? "⟳ 更新中..." : "⟳ 価格を更新"}
              </button>
            </div>
          </div>
        </header>

        {/* stats bar */}
        {coins.length > 0 && (
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24,
          }}>
            {[
              { label: "登録コイン数", value: coins.length },
              { label: "参加者数", value: userRankings.length },
              {
                label: "トップスコア",
                value: coins[0] ? fmtPct(coins[0].score) : "–",
                color: (coins[0]?.score ?? 0) >= 0 ? "var(--green)" : "var(--red)",
              },
              {
                label: "最高騰コイン",
                value: coins[0]?.tokenSymbol ?? "–",
                color: "var(--yellow)",
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                flex: "1 1 140px",
                padding: "14px 18px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card)",
              }}>
                <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text)" }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* register form */}
        <RegisterForm onRegistered={() => { loadData(); }} />

        {/* tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className={`tab-btn${tab === "rankings" ? " active" : ""}`} onClick={() => setTab("rankings")}>
            🏆 ユーザーランキング
          </button>
          <button className={`tab-btn${tab === "coins" ? " active" : ""}`} onClick={() => setTab("coins")}>
            ◎ コイン一覧
          </button>
        </div>

        {/* content */}
        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--dim)" }}>読み込み中...</div>
        ) : tab === "rankings" ? (
          <UserRankings rankings={userRankings} />
        ) : (
          <CoinList coins={coins} />
        )}

        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 12, color: "var(--dim)" }}>
          価格データ: DexScreener API · スコア = (登録時からの最高時価総額 - 登録時時価総額) ÷ 登録時時価総額 × 100
        </footer>
      </div>
    </>
  );
}
