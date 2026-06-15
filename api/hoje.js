// api/hoje.js
// Calcula resultado do dia usando a API pública da Smarttbot
// Usa o último ponto da dailyCumulativePerformance comparado ao penúltimo
// Não requer autenticação — funciona sem token

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
    const date = parts[i];
    const active = parseInt(parts[i+1]);
    const val = parseFloat(parts[i+2]);
    if (date && !isNaN(val)) result.push({ date, active, val });
  }
  return result;
}

function getLastDayReturn(curve, initialCapital) {
  // Filtra só dias ativos
  const active = curve.filter(p => p.active === 1);
  if (active.length < 2) return { ret: 0, date: null, tradesHoje: 0 };
  
  const last = active[active.length - 1];
  const prev = active[active.length - 2];
  
  // Calcular retorno em R$ baseado no capital inicial
  const capital = initialCapital || 10000;
  const retPct = last.val - prev.val; // diferença acumulada
  const retRS = retPct * capital;
  
  return {
    ret: retRS,
    retPct: retPct,
    date: last.date,
    lastVal: last.val,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');

  try {
    const pubRes = await fetch(
      'https://api.smarttbot.com/smarttbot-manager-api/api/v1/store/products?period=SIX_MONTHS',
      { headers: { 'Accept': 'application/json' } }
    );
    if (!pubRes.ok) throw new Error('Erro API pública: ' + pubRes.status);
    const pubData = await pubRes.json();

    const cloudProducts = (pubData.products || []).filter(p =>
      isCloud(p.name, p.strategist?.name)
    );

    if (!cloudProducts.length) {
      return res.status(200).json({ resultados: [], total: 0, ativos: 0, atualizadoEm: new Date().toISOString() });
    }

    // Encontrar a data mais recente entre todos os produtos
    let globalLastDate = '';
    cloudProducts.forEach(p => {
      const curve = parseCurve(p.robot?.dailyCumulativePerformance || '');
      const active = curve.filter(c => c.active === 1);
      if (active.length) {
        const last = active[active.length - 1].date;
        if (last > globalLastDate) globalLastDate = last;
      }
    });

    // Calcular resultado de cada produto para o último dia
    const resultados = cloudProducts.map(p => {
      const curve = parseCurve(p.robot?.dailyCumulativePerformance || '');
      const active = curve.filter(c => c.active === 1);
      if (active.length < 2) return null;
      
      const last = active[active.length - 1];
      
      // Só inclui se o último dia desta estratégia é o mesmo da data global
      if (last.date !== globalLastDate) return null;
      
      const prev = active[active.length - 2];
      const retPct = last.val - prev.val;
      
      // Estimar R$ baseado no capital sugerido ou padrão
      const capital = parseFloat(p.robot?.report?.initialCapital || 10000);
      const retRS = retPct * capital;
      
      // Número de trades hoje (campo da API pública)
      const tradesHoje = p.robot?.report?.todayNumberOfEliminations || 0;

      return {
        id: p.robot?.id,
        nome: p.name,
        resultadoPct: +(retPct * 100).toFixed(2),
        resultadoRS: +retRS.toFixed(2),
        tradesHoje: parseInt(tradesHoje),
        ultimaData: last.date,
      };
    }).filter(Boolean);

    const totalPct = resultados.reduce((s, r) => s + r.resultadoPct, 0);
    const ativos = resultados.filter(r => r.tradesHoje > 0).length;

    return res.status(200).json({
      resultados: resultados.sort((a, b) => b.resultadoPct - a.resultadoPct),
      totalPct: +totalPct.toFixed(2),
      total: +totalPct.toFixed(2),
      ativos,
      ultimaData: globalLastDate,
      atualizadoEm: new Date().toISOString(),
      fonte: 'API pública Smarttbot — resultado do último dia fechado',
    });

  } catch (error) {
    console.error('Erro /api/hoje:', error);
    return res.status(500).json({ error: error.message });
  }
};
