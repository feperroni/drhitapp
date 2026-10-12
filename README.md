# Doctor Hit App

Web app da banda **Doctor Hit**: a plateia lê um QR Code, pede músicas do repertório, sugere novas músicas, manda recados e faz Pix. A banda acompanha os pedidos ao vivo, com notificação no celular/tablet, e tem uma console com shows, repertório e insights.

## Telas

| Rota | Quem usa | O que faz |
|---|---|---|
| `/` | Plateia (QR Code) | Logo, Instagram, show ao vivo, pedir música (artista → música), meus pedidos com posição na fila, sugestões, Pix e recados |
| `/admin/ao-vivo` | Banda (tablet/celular) | Fila em tempo real, aceitar / marcar como tocada / recusar, pausar pedidos, ajustar limites, ativar notificações |
| `/admin` | Banda | Visão geral: acessos, pedidos, músicas e artistas mais pedidos, comparativo por show, músicas nunca pedidas |
| `/admin/shows` | Banda | Cadastrar show (data, local, limites), publicar, encerrar; detalhes e insights de cada show |
| `/admin/repertorio` | Banda | Adicionar, editar, desativar e remover músicas (reflete na hora no app) |
| `/admin/sugestoes` | Banda | Sugestões da plateia → adicionar ao repertório com um clique |
| `/admin/recados` | Banda | Comentários e feedbacks |
| `/admin/config` | Banda | Dados da banda, Pix e **QR Code do app para imprimir** |

> ⚠️ A console (`/admin`) está **aberta, sem login**, por enquanto. O plano é proteger com Google OAuth.

## Regras de pedidos

- Só existe **um show ao vivo** por vez. Publicar um show encerra o anterior.
- Limites configuráveis **por show**: pedidos por pessoa, janela em minutos (padrão: 1 pedido a cada 60 min) e limite total de pedidos do show.
- A pessoa é identificada por um cookie anônimo no celular.
- Pedidos repetidos da mesma música viram votos (×N) na mesma linha da fila.
- A fila segue a ordem do primeiro pedido de cada música. A plateia vê só os próprios pedidos e a posição deles.
- Música marcada como tocada (ou recusada) não pode ser pedida de novo naquele show.

## Tecnologias

Next.js 16 (App Router) + TypeScript + Tailwind 4 · PostgreSQL (`postgres`) · Server-Sent Events para tempo real · Web Push (VAPID) para notificações · Pix BR Code estático gerado no servidor.

O esquema do banco (`db/schema.sql`) é aplicado a cada `npm start`. O repertório inicial (`db/repertorio.json`, extraído do PDF) é carregado automaticamente se a tabela de músicas estiver vazia.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # e gere as chaves VAPID: npx web-push generate-vapid-keys
npm run db:local             # Postgres local (PGlite) na porta 5433, em outro terminal
npm run migrate              # cria as tabelas e carrega o repertório
npm run dev                  # http://localhost:3000
```

## Deploy no Railway

1. **New Project → Deploy from GitHub repo →** `feperroni/drhitapp`.
2. No projeto: **+ New → Database → PostgreSQL**.
3. No serviço do app, em **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (chaves VAPID de produção)
4. Em **Settings → Networking → Generate Domain** para ter o endereço `*.up.railway.app`.
5. Abra `/admin/config` e baixe o QR Code do app para imprimir.

## Notificações no iPhone/iPad

No iOS (16.4 ou mais novo), a notificação só funciona com o app instalado: abra `/admin/ao-vivo` no Safari → **Compartilhar → Adicionar à Tela de Início** → abra pelo ícone → **Ativar notificações**. No Android/Chrome funciona direto no navegador.
