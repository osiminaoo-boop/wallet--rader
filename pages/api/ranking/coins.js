import { getAll } from "../../../lib/coinsDb";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const coins = getAll();

  // User rankings: best score per user across all their coins
  const userMap = {};
  for (const coin of coins) {
    const s = coin.submitter;
    if (!userMap[s]) {
      userMap[s] = { submitter: s, coins: [], bestScore: -Infinity, totalCoins: 0 };
    }
    userMap[s].coins.push(coin);
    userMap[s].totalCoins++;
    if ((coin.score ?? 0) > userMap[s].bestScore) {
      userMap[s].bestScore = coin.score ?? 0;
    }
  }

  const userRankings = Object.values(userMap)
    .map((u) => ({
      ...u,
      avgScore: u.coins.reduce((sum, c) => sum + (c.score ?? 0), 0) / u.coins.length,
    }))
    .sort((a, b) => b.bestScore - a.bestScore);

  const sortedCoins = [...coins].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  res.status(200).json({ coins: sortedCoins, userRankings });
}
