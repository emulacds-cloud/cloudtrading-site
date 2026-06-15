// api/hoje.js
// Usa os IDs da API pública + ss_token para buscar resultado do dia

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const token = process.env.SMARTTBOT_TOKEN;
  if (!token) {
    return res.status(503).json({ error: 'SMARTTBOT_TOKEN não configurado no Vercel' });
  }

  try {
    // 1. Buscar produtos Cloud da API pública (já temos IDs dos robôs)
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

    // 2. Para cada produto Cloud, buscar resultado do dia usando o robot ID
    const BATCH = 4;
    const resultados = [];

    for (let i = 0; i < cloudProducts.length; i += BATCH) {
      const batch = cloudProducts.slice(i, i + BATCH);
      const batchRes = await Promise.allSettled(
        batch.map(async (p) => {
          const robotId = p.robot?.id;
          if (!robotId) return null;

          try {
            const r = await fetch(
              `https://app.smarttbot.com/private/robos/${robotId}/full_report?return_attributes[]=today_net_result&return_attributes[]=today_number_of_eliminations`,
              {
                headers: {
                  'Cookie': `ss_token=${token}`,
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0',
                  'Referer': 'https://app.smarttbot.com/',
                },
              }
            );
            if (!r.ok) return null;
            const d = await r.json();
            const rep = d.report || {};
            return {
              id: robotId,
              nome: p.name,
              resultadoHoje: parseFloat(rep.today_net_result || 0),
              tradesHoje: parseInt(rep.today_number_of_eliminations || 0),
            };
          } catch { return null; }
        })
      );
      batchRes.forEach(r => { if (r.status === 'fulfilled' && r.value) resultados.push(r.value); });
    }

    const validos = resultados.filter(Boolean);

    // Se nenhum retornou (token inválido), retornar erro claro
    if (!validos.length && cloudProducts.length > 0) {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Renove o SMARTTBOT_TOKEN no Vercel → Environment Variables',
        totalProdutos: cloudProducts.length,
      });
    }

    const total = validos.reduce((s, r) => s + r.resultadoHoje, 0);
    const ativos = validos.filter(r => r.tradesHoje > 0).length;

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({
      resultados: validos.sort((a, b) => b.resultadoHoje - a.resultadoHoje),
      total: +total.toFixed(2),
      ativos,
      atualizadoEm: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erro /api/hoje:', error);
    return res.status(500).json({ error: error.message });
  }
};
