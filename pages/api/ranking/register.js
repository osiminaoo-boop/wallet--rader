import { add } from "../../../lib/coinsDb";
import { fetchTokenInfo } from "../../../lib/dexscreener";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { submitter, tokenAddress, comment } = req.body ?? {};

  if (!submitter?.trim()) return res.status(400).json({ error: "ニックネームを入力してください" });
  if (!tokenAddress?.trim()) return res.status(400).json({ error: "トークンアドレスを入力してください" });

  const addr = tokenAddress.trim();
  // Basic Solana address validation (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
    return res.status(400).json({ error: "無効なSolanaアドレスです" });
  }

  let tokenInfo;
  try {
    tokenInfo = await fetchTokenInfo(addr);
  } catch (e) {
    return res.status(502).json({ error: "DexScreener APIの取得に失敗しました" });
  }

  if (!tokenInfo) {
    return res.status(404).json({ error: "このトークンはSolana上で見つかりませんでした" });
  }

  const coin = add({
    submitter: submitter.trim(),
    tokenAddress: addr,
    tokenName: tokenInfo.name,
    tokenSymbol: tokenInfo.symbol,
    comment: comment?.trim() ?? "",
    registeredPrice: tokenInfo.price,
    registeredMcap: tokenInfo.mcap,
    registeredVolume: tokenInfo.volume24h,
    currentPrice: tokenInfo.price,
    currentMcap: tokenInfo.mcap,
    currentVolume: tokenInfo.volume24h,
    priceChange: 0,
    mcapChange: 0,
    score: 0,
    dexUrl: tokenInfo.dexUrl,
    lastUpdated: new Date().toISOString(),
  });

  res.status(200).json({ coin });
}
