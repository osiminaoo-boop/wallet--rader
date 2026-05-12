const BASE = "https://api.dexscreener.com/latest/dex/tokens";

export async function fetchTokenInfo(address) {
  const res = await fetch(`${BASE}/${address}`);
  if (!res.ok) throw new Error(`DexScreener API error: ${res.status}`);
  const data = await res.json();
  const pairs = data.pairs?.filter((p) => p.chainId === "solana") ?? [];
  if (pairs.length === 0) return null;

  // Pick the pair with highest liquidity (USD)
  pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const best = pairs[0];

  return {
    name: best.baseToken?.name ?? "Unknown",
    symbol: best.baseToken?.symbol ?? "?",
    price: parseFloat(best.priceUsd ?? 0),
    mcap: best.fdv ?? best.marketCap ?? 0,
    volume24h: best.volume?.h24 ?? 0,
    pairAddress: best.pairAddress,
    dexUrl: best.url,
  };
}
