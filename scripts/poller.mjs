import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../data/coins.json");
const INTERVAL_MS = 5 * 60 * 1000;
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";
const BATCH_SIZE = 30;

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { coins: [] };
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function fetchBatch(addresses) {
  const url = `${DEXSCREENER_BASE}/${addresses.join(",")}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = {};
  for (const pair of data.pairs ?? []) {
    if (pair.chainId !== "solana") continue;
    const addr = pair.baseToken?.address;
    if (!addr) continue;
    if (!result[addr] || (pair.liquidity?.usd ?? 0) > (result[addr].liquidity?.usd ?? 0)) {
      result[addr] = pair;
    }
  }
  return result;
}

async function poll() {
  const db = readDb();
  if (db.coins.length === 0) return;

  const uniqueAddresses = [...new Set(db.coins.map((c) => c.tokenAddress))];
  const pairMap = {};

  for (let i = 0; i < uniqueAddresses.length; i += BATCH_SIZE) {
    const batch = uniqueAddresses.slice(i, i + BATCH_SIZE);
    try {
      Object.assign(pairMap, await fetchBatch(batch));
    } catch (e) {
      console.error(`[poller] バッチ取得失敗:`, e.message);
    }
  }

  const now = new Date().toISOString();
  let updatedCount = 0;
  let athCount = 0;

  for (const coin of db.coins) {
    const pair = pairMap[coin.tokenAddress];
    if (!pair) continue;

    const currentMcap = pair.fdv ?? pair.marketCap ?? 0;
    const currentPrice = parseFloat(pair.priceUsd ?? 0);

    coin.currentPrice = currentPrice;
    coin.currentMcap = currentMcap;
    coin.currentVolume = pair.volume?.h24 ?? 0;
    coin.lastUpdated = now;
    coin.priceChange =
      coin.registeredPrice > 0
        ? ((currentPrice - coin.registeredPrice) / coin.registeredPrice) * 100
        : 0;

    if (currentMcap > (coin.peakMcap ?? 0)) {
      coin.peakMcap = currentMcap;
      coin.peakMcapAt = now;
      athCount++;
    }

    coin.score =
      coin.registeredMcap > 0
        ? ((coin.peakMcap - coin.registeredMcap) / coin.registeredMcap) * 100
        : 0;

    updatedCount++;
  }

  if (updatedCount > 0) {
    writeDb(db);
    const ts = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    console.log(`[${ts}] ${updatedCount}件更新, ATH更新: ${athCount}件`);
  }
}

// Next.js instrumentation から呼ばれる
export function startPoller() {
  console.log(`[poller] 起動 (間隔: ${INTERVAL_MS / 1000}秒)`);
  poll().catch((e) => console.error("[poller] 初回エラー:", e));
  setInterval(() => {
    poll().catch((e) => console.error("[poller] エラー:", e));
  }, INTERVAL_MS);
}

// 単体起動 (node scripts/poller.mjs) の場合
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) startPoller();
