// api/hoje.js
// Busca resultado do dia de cada robô Cloud usando ss_token das variáveis de ambiente
// O token fica APENAS no servidor Vercel — nunca exposto ao visitante

const EXCLUDED = [
  'carteira hyperion','muraganics one','cloud wallets',
  'primus one','groffon one','devron one','cloud viserion','viserion one',
];

function isCloud(name) {
  const n = (name || '').toLowerCase();
  return (
    n.includes('cloud') || n.includes('uniform') || n.includes('tango') ||
    n.includes('charlie') || n.includes('kilo') || n.includes('golf') ||
    n.includes('vhagar') || n.includes('alfa') || n.includes('bravo') ||
    n.includes('echo') || n.includes('sentinel') || n.includes('silverwing') ||
    n.includes('omega') || n.includes('tracks') || n.includes('blitzwing') ||
    n.includes('grimlock') || n.includes('galvatron') || n.includes('decepticons') ||
    n.includes('wheeljack') || n.includes('grapple') || n.includes('rhaegal') ||
    n.includes('c2') || n.includes('v5') || n.includes('hargen') ||
    n.includes('adaptus') || n.includes('quintessa') || n.includes('seasmoke') ||
    n.includes('kamikaze') || n.includes('midscalper')
  ) && !EXCLUDED.some(ex => n.includes(ex));
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const token = process.env.SMARTTBOT_TOKEN;

  if (!token) {
    return res.status(503).json({
      error: 'Token não configurado',
      message: 'Adicione SMARTTBOT_TOKEN nas variáveis de ambiente do Vercel',
    });
  }

  try {
    // Buscar lista de robôs do usuário
    const robosRes = await fetch('https://app.smarttbot.com/private/robos', {
      headers: {
        'Cookie': `ss_token=${token}`,
        'Accept': 'application/json',
        'User-Agent': 'CloudTrading-Dashboard/1.0',
      },
    });

    if (!robosRes.ok) {
      if (robosRes.status === 401 || robosRes.status === 403) {
        return res.status(401).json({
          error: 'Token expirado',
          message: 'Renove o SMARTTBOT_TOKEN no Vercel',
        });
      }
      throw new Error(`Erro ao buscar robôs: ${robosRes.status}`);
    }

    // A resposta de /private/robos é HTML da página — precisamos da API JSON
    // Usar o endpoint correto da API autenticada
    const statsRes = await fetch('https://app.smarttbot.com/api/v2/user/stats', {
      headers: {
        'Cookie': `ss_token=${token}`,
        'Accept': 'application/json',
      },
    });

    if (!statsRes.ok) throw new Error(`Stats error: ${statsRes.status}`);

    // Buscar da API pública os IDs Cloud e depois pegar resultado autenticado
    const publicRes = await fetch(
      'https://api.smarttbot.com/smarttbot-manager-api/api/v1/store/products?period=SIX_MONTHS',
      { headers: { 'Accept': 'application/json' } }
    );

    if (!publicRes.ok) throw new Error('Erro API pública');
    const publicData = await publicRes.json();

    const cloudProducts = (publicData.products || []).filter(p =>
      isCloud(p.strategist?.name || '') || isCloud(p.name || '')
    );

    if (!cloudProducts.length) {
      return res.status(200).json({
        resultados: [], total: 0, ativos: 0,
        atualizadoEm: new Date().toISOString(),
        aviso: 'Nenhum produto Cloud encontrado',
      });
    }

    // Buscar resultado do dia de cada robô em paralelo (batches de 5)
    const BATCH = 5;
    const resultados = [];

    for (let i = 0; i < cloudProducts.length; i += BATCH) {
      const batch = cloudProducts.slice(i, i + BATCH);
      const batchRes = await Promise.allSettled(
        batch.map(async (p) => {
          const robotId = p.robot?.id;
          if (!robotId) return null;

          const r = await fetch(
            `https://app.smarttbot.com/private/robos/${robotId}/full_report?return_attributes[]=today_net_result&return_attributes[]=today_number_of_eliminations`,
            {
              headers: {
                'Cookie': `ss_token=${token}`,
                'Accept': 'application/json',
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
        })
      );

      batchRes.forEach(r => {
        if (r.status === 'fulfilled' && r.value) resultados.push(r.value);
      });
    }

    const validos = resultados.filter(Boolean);
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
