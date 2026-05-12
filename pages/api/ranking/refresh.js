import { getAll, updatePrices } from "../../../lib/coinsDb";
import { fetchTokenInfo } from "../../../lib/dexscreener";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const coins = getAll();
  if (coins.length === 0) return res.status(200).json({ updated: 0 });

  // Deduplicate addresses to minimize API calls
  const addrMap = {};
  for (const coin of coins) {
    if (!addrMap[coin.tokenAddress]) addrMap[coin.tokenAddress] = [];
    addrMap[coin.tokenAddress].push(coin.id);
  }

  const updates = [];
  const now = new Date().toISOString();

  await Promise.allSettled(
    Object.entries(addrMap).map(async ([address, ids]) => {
      try {
        const info = await fetchTokenInfo(address);
        if (!info) return;
        for (const id of ids) {
          updates.push({
            id,
            currentPrice: info.price,
            currentMcap: info.mcap,
            currentVolume: info.volume24h,
            lastUpdated: now,
          });
        }
      } catch {
        // skip failed tokens
      }
    })
  );

  const updated = updatePrices(updates);
  res.status(200).json({ updated: updates.length, coins: updated });
}
