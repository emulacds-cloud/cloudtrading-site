// api/planilha.js - Busca CSV do Google Sheets no servidor

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');

  try {
    const SHEET_ID = '1HHq1L9mHQGjrWBXpxuTlYLdt8kGxW8GrQyP65IUmhKc';
    const GID      = '1687620098';

    // Usar o URL de export público do Google Sheets
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}&single=true`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CloudTrading/1.0)',
        'Accept': 'text/csv,text/plain,*/*',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      // Tentar URL alternativa
      const url2 = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
      const r2 = await fetch(url2, { redirect: 'follow' });
      if (!r2.ok) throw new Error(`Google Sheets: ${response.status}`);
      const csv2 = await r2.text();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(csv2);
    }

    const csv = await response.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(csv);

  } catch (error) {
    console.error('Erro planilha:', error);
    return res.status(500).json({ error: error.message });
  }
};
