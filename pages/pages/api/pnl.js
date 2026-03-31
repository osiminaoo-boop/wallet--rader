export default async function handler(req, res) {
  const { wallet } = req.query;

  const response = await fetch(
    `https://pro-api.solscan.io/v2.0/account/balance_change?address=${wallet}`,
    {
      headers: {
        token: process.env.SOLSCAN_API_KEY,
      },
    }
  );

  const data = await response.json();

  res.status(200).json(data);
}
