import { useState } from "react";

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [ca, setCa] = useState("");
  const [result, setResult] = useState("");

  const fetchPnL = async () => {
    setResult("計算中...");
    try {
      const res = await fetch(`/api/pnl?wallet=${wallet}&ca=${ca}`);
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch {
      setResult("エラー");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>UniversalX PnL</h1>
      <input placeholder="wallet" onChange={(e) => setWallet(e.target.value)} />
      <br />
      <input placeholder="token CA" onChange={(e) => setCa(e.target.value)} />
      <br />
      <button onClick={fetchPnL}>計算</button>
      <pre>{result}</pre>
    </div>
  );
}
