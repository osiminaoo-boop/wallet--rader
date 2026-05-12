import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DB_PATH = path.join(process.cwd(), "data", "coins.json");

function read() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { coins: [] };
  }
}

function write(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function getAll() {
  return read().coins;
}

export function add(coin) {
  const db = read();
  const record = { id: randomUUID(), ...coin, registeredAt: new Date().toISOString() };
  db.coins.push(record);
  write(db);
  return record;
}

export function updatePrices(updates) {
  const db = read();
  for (const { id, currentPrice, currentMcap, currentVolume, lastUpdated } of updates) {
    const coin = db.coins.find((c) => c.id === id);
    if (!coin) continue;
    coin.currentPrice = currentPrice;
    coin.currentMcap = currentMcap;
    coin.currentVolume = currentVolume;
    coin.lastUpdated = lastUpdated;
    coin.priceChange =
      coin.registeredPrice > 0
        ? ((currentPrice - coin.registeredPrice) / coin.registeredPrice) * 100
        : 0;
    coin.mcapChange =
      coin.registeredMcap > 0
        ? ((currentMcap - coin.registeredMcap) / coin.registeredMcap) * 100
        : 0;
    coin.score = (coin.priceChange + coin.mcapChange) / 2;
  }
  write(db);
  return db.coins;
}
