# Cloud Trading Dashboard

Dashboard de performance para estratégias Cloud Trading na Smarttbot.

## Configuração do Token (uma única vez)

Para ativar o resultado do dia em tempo real:

1. Acesse **vercel.com** → seu projeto → **Settings** → **Environment Variables**

2. Adicione:
   - **Name:** `SMARTTBOT_TOKEN`
   - **Value:** o valor do cookie `ss_token` da Smarttbot
   - **Environment:** Production, Preview, Development (marque todos)

3. Clique em **Save**

4. Vá em **Deployments** → clique nos 3 pontinhos do último deploy → **Redeploy**

### Como obter o ss_token

1. Acesse app.smarttbot.com e faça login
2. Abra DevTools (⌘+Option+I no Mac)
3. Aba **Application** → **Cookies** → **app.smarttbot.com**
4. Encontre `ss_token` e copie o valor completo

### Renovação do token

O token expira periodicamente. Quando expirar, o resultado do dia para de aparecer mas o resto do dashboard continua funcionando normalmente. Basta repetir o processo acima com o novo token.

## Estrutura

```
/
├── index.html          # Dashboard principal
├── vercel.json         # Configuração do Vercel
├── api/
│   ├── produtos.js     # Proxy para API pública Smarttbot (sem auth)
│   └── hoje.js         # Resultado do dia via token (servidor)
└── README.md
```

## Como funciona

- **`/api/produtos`** — busca estratégias da API pública da Smarttbot, adiciona cache de 1h no servidor
- **`/api/hoje`** — usa o `SMARTTBOT_TOKEN` para buscar resultado do dia de cada robô Cloud. O token nunca é exposto ao visitante
- O dashboard atualiza automaticamente a cada hora
- Visitantes não precisam fazer nenhuma configuração
