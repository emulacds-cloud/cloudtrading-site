// api/produtos.js
// Busca estratégias Cloud da API pública da Smarttbot
// Roda no servidor Vercel — evita CORS e adiciona cache de 1 hora

export default async function handler(req, res) {
  try {
    const period = req.query.period || 'SIX_MONTHS';
    
    const response = await fetch(
      `https://api.smarttbot.com/smarttbot-manager-api/api/v1/store/products?period=${period}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CloudTrading-Dashboard/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Smarttbot API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache no servidor por 1 hora
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(data);

  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: error.message });
  }
}
