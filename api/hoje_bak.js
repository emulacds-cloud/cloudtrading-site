// api/hoje.js
// Busca resultado do dia de cada robô Cloud usando ss_token das variáveis de ambiente
// O token fica APENAS no servidor Vercel — nunca exposto ao visitante
// Atualiza a cada 1 hora via cache do Vercel

const EXCLUDED = [
  'carteira hyperion',
  'muraganics one',
  'cloud wallets',
  'primus one',
  'groffon one',
  'devron one',
  'cloud viserion',
  'viserion one',
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
    n.includes('kamikaze') || n.includes('midscalper') || n.includes('bravo')
  ) && !EXCLUDED.some(ex => n.includes(ex));
}

export default async function handler(req, res) {
  const token = process.env.SMARTTBOT_TOKEN;

  if (!token) {
    return res.status(503).json({
      error: 'Token não configurado',
      message: 'Adicione SMARTTBOT_TOKEN nas variáveis de ambiente do Vercel',
    });
  }

  try {
    // 1. Buscar lista de robôs do usuário
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
          error: 'Token expirado ou inválido',
          message: 'Renove o SMARTTBOT_TOKEN nas variáveis de ambiente do Vercel',
        });
      }
      throw new Error(`Erro ao buscar robôs: ${robosRes.status}`);
    }

    const robosData = await robosRes.json();
    const todosRobos = robosData.robos || robosData.robots || robosData || [];

    // 2. Filtrar apenas estratégias Cloud
    const cloudRobos = todosRobos.filter(r => isCloud(r.robotName || r.name || ''));

    if (!cloudRobos.length) {
      return res.status(200).json({
        resultados: [],
        total: 0,
        atualizadoEm: new Date().toISOString(),
        aviso: 'Nenhum robô Cloud encontrado nesta conta',
      });
    }

    // 3. Buscar resultado do dia de cada robô em paralelo
    const resultados = await Promise.all(
      cloudRobos.map(async (robo) => {
        try {
          const id = robo.id || robo.robotId;
          const reportRes = await fetch(
            `https://app.smarttbot.com/private/robos/${id}/full_report?return_attributes[]=today_net_result&return_attributes[]=today_number_of_eliminations&return_attributes[]=balance`,
            {
              headers: {
                'Cookie': `ss_token=${token}`,
                'Accept': 'application/json',
              },
            }
          );

          if (!reportRes.ok) return null;

          const reportData = await reportRes.json();
          const report = reportData.report || {};

          return {
            id,
            nome: robo.robotName || robo.name,
            resultadoHoje: parseFloat(report.today_net_result || 0),
            tradesHoje: parseInt(report.today_number_of_eliminations || 0),
            saldo: parseFloat(report.balance || 0),
          };
        } catch {
          return null;
        }
      })
    );

    // 4. Filtrar nulos e calcular total
    const validos = resultados.filter(Boolean);
    const total = validos.reduce((s, r) => s + r.resultadoHoje, 0);
    const ativos = validos.filter(r => r.tradesHoje > 0);

    // Cache de 1 hora no servidor
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      resultados: validos.sort((a, b) => b.resultadoHoje - a.resultadoHoje),
      total: +total.toFixed(2),
      ativos: ativos.length,
      atualizadoEm: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erro em /api/hoje:', error);
    return res.status(500).json({ error: error.message });
  }
}
