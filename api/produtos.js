// api/produtos.js
// Proxy para API pública Smarttbot — resolve CORS e adiciona cache no servidor

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const period = req.query.period || 'SIX_MONTHS';

    const response = await fetch(
      `https://api.smarttbot.com/smarttbot-manager-api/api/v1/store/products?period=${period}`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'CloudTrading-Dashboard/1.0' } }
    );

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
