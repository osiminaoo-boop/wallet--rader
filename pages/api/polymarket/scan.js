import {
  getLeaderboard,
  batchGetPositions,
  scoreWallet,
} from "../../../lib/polymarket.js";

const SIGNAL_MIN_WALLETS = 3; // minimum whale wallets on same side
const TOP_WALLET_LIMIT = 50;  // how many leaderboard wallets to track
const MIN_POSITION_SIZE = 10; // minimum USDC position size to count

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const window = req.query.window || "1w";

  try {
    // 1. Fetch top wallets from leaderboard
    const leaderboard = await getLeaderboard({ window, limit: TOP_WALLET_LIMIT });

    if (!leaderboard.length) {
      return res.status(200).json({ wallets: [], signals: [], scannedAt: Date.now() });
    }

    // 2. Score and enrich wallet data
    const scoredWallets = leaderboard.map((w) => {
      const address =
        w.proxy_wallet_address ??
        w.proxyWalletAddress ??
        w.address ??
        w.wallet ??
        "";
      return {
        address,
        name: w.name ?? w.username ?? null,
        profit: w.profit ?? w.pnl ?? 0,
        winRate: w.win_rate ?? w.winRate ?? 0,
        tradesCount: w.trades_count ?? w.tradesCount ?? w.numTrades ?? 0,
        volume: w.volume ?? 0,
        score: scoreWallet(w),
      };
    }).filter((w) => w.address);

    // 3. Batch-fetch open positions for all tracked wallets
    const addresses = scoredWallets.map((w) => w.address);
    const positionMap = await batchGetPositions(addresses, 8);

    // 4. Build wallet summary with their positions
    const wallets = scoredWallets.map((w) => ({
      ...w,
      positions: (positionMap.get(w.address) ?? []).filter(
        (p) => (p.size ?? p.currentValue ?? 0) >= MIN_POSITION_SIZE
      ),
    }));

    // 5. Detect convergence signals
    // Group positions by (conditionId + outcome)
    const marketBuckets = new Map(); // key => { marketInfo, wallets[] }

    for (const wallet of wallets) {
      for (const pos of wallet.positions) {
        const conditionId =
          pos.conditionId ??
          pos.condition_id ??
          pos.market ??
          pos.marketId ??
          "";
        const outcome = pos.outcome ?? pos.side ?? "";
        const title = pos.title ?? pos.question ?? pos.market ?? conditionId;
        const avgPrice = pos.avgPrice ?? pos.average_price ?? pos.price ?? null;
        const currentValue = pos.currentValue ?? pos.size ?? 0;

        if (!conditionId || !outcome) continue;

        const key = `${conditionId}::${outcome}`;
        if (!marketBuckets.has(key)) {
          marketBuckets.set(key, {
            conditionId,
            outcome,
            title,
            wallets: [],
          });
        }
        marketBuckets.get(key).wallets.push({
          address: wallet.address,
          name: wallet.name,
          score: wallet.score,
          winRate: wallet.winRate,
          avgPrice,
          positionValue: currentValue,
        });
      }
    }

    // 6. Filter to signals where enough top wallets converge
    const signals = [];
    for (const [, bucket] of marketBuckets) {
      if (bucket.wallets.length < SIGNAL_MIN_WALLETS) continue;

      const avgScore = bucket.wallets.reduce((s, w) => s + w.score, 0) / bucket.wallets.length;
      const avgWinRate = bucket.wallets.reduce((s, w) => s + w.winRate, 0) / bucket.wallets.length;
      const avgPrice =
        bucket.wallets.filter((w) => w.avgPrice != null).length > 0
          ? bucket.wallets
              .filter((w) => w.avgPrice != null)
              .reduce((s, w) => s + w.avgPrice, 0) /
            bucket.wallets.filter((w) => w.avgPrice != null).length
          : null;

      // Confidence: based on wallet count, avg score, and avg win rate
      const walletCountFactor = Math.min(bucket.wallets.length / 5, 1);
      const confidence = Math.round(
        (walletCountFactor * 0.4 + (avgScore / 100) * 0.3 + avgWinRate * 0.3) * 100
      );

      signals.push({
        conditionId: bucket.conditionId,
        title: bucket.title,
        outcome: bucket.outcome,
        walletCount: bucket.wallets.length,
        avgPrice,
        avgScore: Math.round(avgScore),
        avgWinRate: Math.round(avgWinRate * 100) / 100,
        confidence,
        wallets: bucket.wallets.sort((a, b) => b.score - a.score),
        detectedAt: Date.now(),
      });
    }

    // Sort signals by confidence desc
    signals.sort((a, b) => b.confidence - a.confidence || b.walletCount - a.walletCount);

    return res.status(200).json({
      wallets: wallets.map((w) => ({
        address: w.address,
        name: w.name,
        profit: w.profit,
        winRate: w.winRate,
        tradesCount: w.tradesCount,
        score: w.score,
        openPositions: w.positions.length,
      })),
      signals: signals.slice(0, 20),
      scannedAt: Date.now(),
      meta: {
        walletsScanned: wallets.length,
        signalsFound: signals.length,
        window,
      },
    });
  } catch (err) {
    console.error("[polymarket/scan]", err);
    return res.status(500).json({ error: err?.message || "Scan failed" });
  }
}
