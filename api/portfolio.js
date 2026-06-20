// api/portfolio.js
// Proxy que cruza portfolioCode da API de produtos com investment_portfolios
// Retorna curva atualizada diariamente + orders por dia

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300'); // cache 5 min

  const { code } = req.query;

  try {
    if (code) {
      // Modo 1: busca um portfólio específico pelo portfolioCode
      const data = await fetchPortfolio(code);
      return res.status(200).json(data);
    } else {
      // Modo 2: busca todos os produtos Cloud, extrai portfolioCode e enriquece
      const enriched = await fetchAllCloudPortfolios();
      return res.status(200).json(enriched);
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

async function fetchPortfolio(code) {
  const url = `https://app.smarttbot.com/api/v2/investment_portfolios/${code}`;
  const r = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
  });
  if (!r.ok) throw new Error(`investment_portfolios/${code} returned ${r.status}`);
  const data = await r.json();

  // Processar investments: extrair curva e orders
  const investments = (data.investments || []).map(inv => {
    const curve = parseCurve(inv.daily_cumulative_performance || '');
    const orders = inv.orders || {};
    const dates  = Object.keys(orders).sort();
    const lastDate = dates[dates.length - 1];
    const lastOrders = orders[lastDate] || 0;

    // Calcular resultado do dia: diferença dos últimos 2 pontos ativos
    const activePts = curve.filter(p => p.active);
    const todayRet  = activePts.length >= 2
      ? activePts[activePts.length - 1].v - activePts[activePts.length - 2].v
      : null;

    // Calcular resultado do mês corrente
    const now    = new Date();
    const mesAno = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const mesPts = curve.filter(p => p.d && p.d.startsWith(mesAno) && p.active);
    const prevPt = curve.filter(p => p.d < mesAno + '-01' && p.active).pop();
    const mesRet = mesPts.length > 0 && prevPt
      ? mesPts[mesPts.length - 1].v - prevPt.v
      : null;

    return {
      id:         inv.id,
      name:       inv.name?.trim(),
      start_date: inv.start_date,
      final_date: inv.final_date,
      login:      inv.login,
      lastDate,
      lastOrders,
      todayRet,   // retorno % do dia (diferença da curva)
      mesRet,     // retorno % do mês corrente
      curve,      // curva completa parseada [{d, active, v}]
      orders,     // {data: nTrades}
    };
  });

  return {
    code:        data.code,
    type:        data.type,
    investments,
  };
}

async function fetchAllCloudPortfolios() {
  // 1. Buscar todos os produtos Cloud
  const prodUrl = 'https://api.smarttbot.com/smarttbot-manager-api/api/v1/store/products?period=SIX_MONTHS';
  const prodRes = await fetch(prodUrl, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
  });
  if (!prodRes.ok) throw new Error(`Produtos API returned ${prodRes.status}`);
  const prodData = await prodRes.json();

  const cloudProds = (prodData.products || []).filter(p =>
    ((p.strategist?.name || '').toLowerCase().includes('cloud') ||
     (p.name || '').toLowerCase().includes('cloud')) &&
    p.portfolioCode
  );

  // 2. Para cada produto Cloud, buscar o investment_portfolio
  const results = await Promise.allSettled(
    cloudProds.map(async p => {
      try {
        const portData = await fetchPortfolio(p.portfolioCode);
        return {
          productId:     p.id,
          name:          p.name,
          portfolioCode: p.portfolioCode,
          strategist:    p.strategist?.name,
          report:        p.robot?.report || {},
          portfolio:     portData,
        };
      } catch(e) {
        return {
          productId:     p.id,
          name:          p.name,
          portfolioCode: p.portfolioCode,
          error:         e.message,
        };
      }
    })
  );

  return {
    total: cloudProds.length,
    products: results.map(r => r.status === 'fulfilled' ? r.value : r.reason),
  };
}

function parseCurve(str) {
  if (!str) return [];
  const parts = str.split(',');
  const result = [];
  for (let i = 0; i < parts.length; i += 3) {
    const d      = parts[i];
    const active = parseInt(parts[i+1]) === 1;
    const v      = parseFloat(parts[i+2]);
    if (d && !isNaN(v)) result.push({ d, active, v });
  }
  return result;
}
