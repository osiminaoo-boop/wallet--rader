import { fetchPnL } from "../../lib/pnl.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const wallet = String(req.body?.wallet || "").trim();
    const mint = String(req.body?.mint || "").trim();

    if (!wallet || !mint) {
      return res.status(400).json({ error: "wallet と mint は必須です" });
    }

    const data = await fetchPnL({ wallet, mint });
    return res.status(200).json(data);
  } catch (err) {
    const message = err?.message || "Server error";
    return res.status(500).json({ error: message });
  }
}
