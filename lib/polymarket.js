const GAMMA_API = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";

async function pmGet(base, path, params = {}) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Polymarket API error ${res.status}: ${path}`);
  }
  return res.json();
}

/**
 * Fetch leaderboard top wallets.
 * window: "1d" | "1w" | "1m" | "all"
 */
export async function getLeaderboard({ window = "1w", limit = 50 } = {}) {
  const data = await pmGet(DATA_API, "/leaderboard", { window, limit });
  // API returns array or { data: [...] }
  return Array.isArray(data) ? data : (data?.data ?? []);
}

/**
 * Fetch open positions for a wallet address.
 */
export async function getWalletPositions(address, { limit = 500 } = {}) {
  try {
    const data = await pmGet(DATA_API, "/positions", {
      user: address,
      limit,
      sizeThreshold: "0.01",
    });
    return Array.isArray(data) ? data : (data?.data ?? []);
  } catch {
    return [];
  }
}

/**
 * Fetch market info by condition ID.
 */
export async function getMarket(conditionId) {
  try {
    const data = await pmGet(GAMMA_API, `/markets/${conditionId}`);
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch recent activity/trades for a wallet.
 */
export async function getWalletTrades(address, { limit = 100 } = {}) {
  try {
    const data = await pmGet(DATA_API, "/trades", {
      user: address,
      limit,
    });
    return Array.isArray(data) ? data : (data?.data ?? []);
  } catch {
    return [];
  }
}

/**
 * Batch fetch positions for multiple wallets with concurrency control.
 */
export async function batchGetPositions(addresses, concurrency = 8) {
  const results = new Map();
  for (let i = 0; i < addresses.length; i += concurrency) {
    const batch = addresses.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map((addr) => getWalletPositions(addr))
    );
    settled.forEach((r, idx) => {
      results.set(batch[idx], r.status === "fulfilled" ? r.value : []);
    });
  }
  return results;
}

/**
 * Score a wallet based on leaderboard metrics.
 * Returns a score 0-100.
 */
export function scoreWallet(wallet) {
  const winRate = wallet.win_rate ?? wallet.winRate ?? 0;
  const profit = wallet.profit ?? wallet.pnl ?? 0;
  const trades = wallet.trades_count ?? wallet.tradesCount ?? wallet.numTrades ?? 1;

  // Normalise profit on a log scale capped at 100k
  const profitScore = Math.min(Math.log10(Math.max(profit, 1)) / Math.log10(100000), 1);
  const winScore = winRate; // already 0-1
  const activityScore = Math.min(Math.log10(Math.max(trades, 1)) / Math.log10(500), 1);

  return Math.round((winScore * 0.45 + profitScore * 0.35 + activityScore * 0.20) * 100);
}
