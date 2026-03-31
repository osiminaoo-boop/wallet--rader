import { fetchAllBalanceChanges } from "./solscan.js";

export const SOL_MINT = "So11111111111111111111111111111111111111112";

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function firstDefined(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function signedChange(row) {
  const pre = firstDefined(row, ["pre_balance", "before"]);
  const post = firstDefined(row, ["post_balance", "after"]);
  if (pre !== undefined && post !== undefined) return num(post) - num(pre);

  const amount = firstDefined(row, ["amount", "change_amount", "delta"]);
  if (amount !== undefined) {
    const raw = num(amount);
    const type = String(
      firstDefined(row, ["change_type", "direction", "flow"]) || ""
    ).toLowerCase();
    if (type.includes("dec") || type === "out") return -Math.abs(raw);
    if (type.includes("inc") || type === "in") return Math.abs(raw);
    return raw;
  }
  return 0;
}

function txIdOf(row) {
  return String(
    firstDefined(row, ["trans_id", "tx_hash", "signature"]) || ""
  );
}

function timeOf(row) {
  return num(firstDefined(row, ["block_time", "time", "blockId"]) || 0);
}

function feeOf(row) {
  return num(firstDefined(row, ["fee"]) || 0);
}

function groupByTx(rows) {
  const map = new Map();
  for (const row of rows) {
    const txId = txIdOf(row);
    if (!txId) continue;
    const arr = map.get(txId) || [];
    arr.push(row);
    map.set(txId, arr);
  }
  return map;
}

function summarizeRows(rows) {
  const byTx = groupByTx(rows);
  const out = [];
  for (const [txId, group] of byTx.entries()) {
    const amount = group.reduce((sum, row) => sum + signedChange(row), 0);
    const fee = Math.max(...group.map(feeOf), 0);
    const blockTime = Math.max(...group.map(timeOf), 0);
    out.push({ txId, amount, fee, blockTime });
  }
  return out.sort((a, b) => a.blockTime - b.blockTime);
}

function buildTradeEvents(tokenRows, solRows) {
  const tokenByTx = groupByTx(tokenRows);
  const solByTx = groupByTx(solRows);

  const trades = [];
  const warnings = [];

  for (const [txId, tokenGroup] of tokenByTx.entries()) {
    const tokenAmount = tokenGroup.reduce(
      (sum, row) => sum + signedChange(row),
      0
    );
    if (!Number.isFinite(tokenAmount) || tokenAmount === 0) continue;

    const solGroup = solByTx.get(txId) || [];
    const solAmount = solGroup.reduce((sum, row) => sum + signedChange(row), 0);
    const fee = Math.max(
      ...tokenGroup.concat(solGroup).map(feeOf),
      0
    );
    const blockTime = Math.max(
      ...tokenGroup.concat(solGroup).map(timeOf),
      0
    );

    let type = "other";
    if (tokenAmount > 0 && solAmount < 0) type = "buy";
    if (tokenAmount < 0 && solAmount > 0) type = "sell";

    trades.push({
      txId,
      blockTime,
      type,
      tokenAmount: Math.abs(tokenAmount),
      solAmount: Math.abs(solAmount),
      rawTokenAmount: tokenAmount,
      rawSolAmount: solAmount,
      fee,
    });
  }

  trades.sort((a, b) => a.blockTime - b.blockTime);

  const lots = [];
  let realizedPnlSol = 0;
  let totalBoughtTokens = 0;
  let totalSoldTokens = 0;
  let totalBuySol = 0;
  let totalSellSol = 0;
  let reportedFeesSol = 0;

  for (const trade of trades) {
    // Solscan fee is in lamports
    reportedFeesSol += trade.fee / 1e9;

    if (trade.type === "buy") {
      lots.push({
        qty: trade.tokenAmount,
        costSol: trade.solAmount,
        txId: trade.txId,
        blockTime: trade.blockTime,
      });
      totalBoughtTokens += trade.tokenAmount;
      totalBuySol += trade.solAmount;
      continue;
    }

    if (trade.type === "sell") {
      let remaining = trade.tokenAmount;
      let basisSol = 0;

      while (remaining > 1e-12 && lots.length) {
        const lot = lots[0];
        const take = Math.min(remaining, lot.qty);
        const lotBasis = lot.costSol * (take / lot.qty);

        basisSol += lotBasis;
        lot.qty -= take;
        lot.costSol -= lotBasis;
        remaining -= take;

        if (lot.qty <= 1e-12) lots.shift();
      }

      if (remaining > 1e-10) {
        warnings.push(
          `売却数量の一部を保有ロットで追跡できませんでした: ${trade.txId}`
        );
      }

      const pnl = trade.solAmount - basisSol;
      realizedPnlSol += pnl;
      totalSoldTokens += trade.tokenAmount;
      totalSellSol += trade.solAmount;
      trade.realizedPnlSol = pnl;
      continue;
    }

    warnings.push(
      `買い/売りとして判定できない tx をスキップしました: ${trade.txId}`
    );
  }

  const openPositionTokens = lots.reduce((sum, lot) => sum + lot.qty, 0);
  const openCostBasisSol = lots.reduce((sum, lot) => sum + lot.costSol, 0);

  return {
    trades,
    summary: {
      realizedPnlSol,
      totalBoughtTokens,
      totalSoldTokens,
      totalBuySol,
      totalSellSol,
      openPositionTokens,
      openCostBasisSol,
      reportedFeesSol,
      analyzedTxCount: trades.length,
      warnings,
    },
  };
}

export async function fetchPnL({ wallet, mint, maxRows = 1000 }) {
  const [tokenRows, solRows] = await Promise.all([
    fetchAllBalanceChanges({ address: wallet, token: mint, maxItems: maxRows }),
    fetchAllBalanceChanges({
      address: wallet,
      token: SOL_MINT,
      maxItems: maxRows,
    }),
  ]);

  const tokenSample = summarizeRows(tokenRows);
  const solSample = summarizeRows(solRows);

  const { trades, summary } = buildTradeEvents(tokenRows, solRows);

  summary.tokenActivities = tokenRows.length;
  summary.solActivities = solRows.length;
  summary.tokenTxCount = tokenSample.length;
  summary.solTxCount = solSample.length;

  return {
    wallet,
    mint,
    trades,
    summary,
  };
}
