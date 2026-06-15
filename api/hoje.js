// api/hoje.js — Resultado do último dia fechado em R$
// Usa initialCapital de cada estratégia para calcular valor financeiro real

const EXCLUDED = [
  'carteira hyperion','muraganics one','cloud wallets',
  'primus one','groffon one','devron one','cloud viserion','viserion one',
];

function isCloud(name, strategist) {
  const n = (name || '').toLowerCase();
  const s = (strategist || '').toLowerCase();
  return (s.includes('cloud') || n.includes('cloud') || n.includes('uniform') ||
    n.includes('tango') || n.includes('charlie') || n.includes('kilo') ||
    n.includes('golf') || n.includes('vhagar') || n.includes('alfa') ||
    n.includes('bravo') || n.includes('echo') || n.includes('sentinel') ||
    n.includes('silverwing') || n.includes('omega') || n.includes('tracks') ||
    n.includes('blitzwing') || n.includes('grimlock') || n.includes('galvatron') ||
    n.includes('decepticons') || n.includes('wheeljack') || n.includes('grapple') ||
    n.includes('rhaegal') || n.includes('c2') || n.includes('v5') ||
    n.includes('hargen') || n.includes('adaptus') || n.includes('quintessa') ||
    n.includes('seasmoke') || n.includes('kamikaze') || n.includes('midscalper')
  ) && !EXCLUDED.some(ex => n.includes(ex));
}

function parseCurve(str) {
  if (!str) return [];
  const parts = str.split(',');
  const result = [];
  for (let i = 0; i < parts.length; i += 3) {
    const date = parts[i], active = parseInt(parts[i+1]), val = parseFloat(parts[i+2]);
    if (date && !isNaN(val)) result.push({ date, active, val });
  }
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');

  try {
    const pubRes = await fetch(
      'https://api.smarttbot.com/smarttbot-manager-api/api/v1/store/products?period=SIX_MONTHS',
      { headers: { 'Accept': 'application/json' } }
    );
    if (!pubRes.ok) throw new Error('Erro API: ' + pubRes.status);
    const pubData = await pubRes.json();

    const cloudProducts = (pubData.products || []).filter(p =>
      isCloud(p.name, p.strategist?.name)
    );

    if (!cloudProducts.length) {
      return res.status(200).json({ resultados: [], ultimaData: null, atualizadoEm: new Date().toISOString() });
    }

    // Encontrar data mais recente entre todos
    let globalLastDate = '';
    cloudProducts.forEach(p => {
      const curve = parseCurve(p.robot?.dailyCumulativePerformance || '');
      const active = curve.filter(c => c.active === 1);
      if (active.length) {
        const last = active[active.length - 1].date;
        if (last > globalLastDate) globalLastDate = last;
      }
    });

    const resultados = cloudProducts.map(p => {
      const curve = parseCurve(p.robot?.dailyCumulativePerformance || '');
      const active = curve.filter(c => c.active === 1);
      if (active.length < 2) return null;

      const last = active[active.length - 1];
      if (last.date !== globalLastDate) return null;

      const prev = active[active.length - 2];
      const retPct = last.val - prev.val; // diferença em ponto percentual da curva normalizada

      // Capital inicial da estratégia para calcular R$
      const capital = parseFloat(p.robot?.report?.initialCapital || 0);
      // R$ = diferença percentual × capital inicial
      const retRS = capital > 0 ? retPct * capital : null;

      return {
        id: p.robot?.id,
        nome: p.name,
        resultadoPct: +(retPct * 100).toFixed(2),
        resultadoRS: retRS !== null ? +retRS.toFixed(2) : null,
        capital: capital,
        tradesHoje: parseInt(p.robot?.report?.todayNumberOfEliminations || 0),
        ultimaData: last.date,
      };
    }).filter(Boolean);

    // Ordenar por % decrescente
    resultados.sort((a, b) => b.resultadoPct - a.resultadoPct);

    return res.status(200).json({
      resultados,
      ultimaData: globalLastDate,
      total: +resultados.reduce((s, r) => s + r.resultadoPct, 0).toFixed(2),
      atualizadoEm: new Date().toISOString(),
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
