// api/portfolio.js
// Cruza portfolioCode da API de produtos com investment_portfolios
// Calcula resultado dia e mês em R$ usando initialCapital da API pública

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');

  const { code } = req.query;

  try {
    if (code) {
      const data = await fetchPortfolio(code);
      return res.status(200).json(data);
    } else {
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
  return await r.json();
}

async function fetchAllCloudPortfolios() {
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

  const results = await Promise.allSettled(
    cloudProds.map(async p => {
      const capital = parseFloat(p.robot?.report?.initialCapital || 0);
      try {
        const raw = await fetchPortfolio(p.portfolioCode);
        const inv = raw.investments?.[0];
        const curve = parseCurve(inv?.daily_cumulative_performance || '');
        const orders = inv?.orders || {};

        // Resultado do dia: diferença entre último e penúltimo ponto ativo
        const active = curve.filter(pt => pt.active);
        let diaRet = null, diaRS = null;
        if (active.length >= 2) {
          diaRet = active[active.length-1].v - active[active.length-2].v;
          if (capital > 0) diaRS = diaRet * capital;
        }

        // Resultado do mês: variação desde 1º do mês atual
        const now    = new Date();
        const mesAno = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const mesPts = active.filter(pt => pt.d && pt.d.startsWith(mesAno));
        const prevPt = active.filter(pt => pt.d && pt.d < mesAno+'-01').pop();
        let mesRet = null, mesRS = null;
        if (mesPts.length > 0 && prevPt) {
          mesRet = (mesPts[mesPts.length-1].v / prevPt.v) - 1;
          if (capital > 0) mesRS = mesRet * capital;
        }

        // Último dia com dados
        const dates   = Object.keys(orders).sort();
        const lastDate = dates[dates.length-1] || null;

        return {
          name:          p.name,
          portfolioCode: p.portfolioCode,
          capital,
          diaRet,  // % do dia
          diaRS,   // R$ do dia
          mesRet,  // % do mês
          mesRS,   // R$ do mês
          lastDate,
          curve,   // curva completa [{d, active, v}]
          orders,  // {data: nTrades}
        };
      } catch(e) {
        return {
          name:          p.name,
          portfolioCode: p.portfolioCode,
          capital,
          error:         e.message,
        };
      }
    })
  );

  return {
    total:    cloudProds.length,
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
