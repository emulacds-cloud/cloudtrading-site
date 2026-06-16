// api/planilha.js
// Busca o CSV do Google Sheets no servidor para evitar bloqueio de CORS

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');

  try {
    const SHEET_ID = '1HHq1L9mHQGjrWBXpxuTlYLdt8kGxW8GrQyP65IUmhKc';
    const GID      = '1687620098';
    const url      = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'CloudTrading-Dashboard/1.0' },
      redirect: 'follow',
    });

    if (!response.ok) throw new Error(`Google Sheets error: ${response.status}`);

    const csv = await response.text();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(csv);

  } catch (error) {
    console.error('Erro ao buscar planilha:', error);
    return res.status(500).json({ error: error.message });
  }
};
