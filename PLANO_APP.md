# Plano: Converter Dashboards em App Web com TiDB

## Objetivo
Transformar os dois dashboards HTML estáticos em uma aplicação web dinâmica onde os dados vêm do TiDB Cloud e os usuários podem EDITAR status em tempo real.

## Arquivos Base (atualizados 13-14/Jul/2026)
- `Dashboard Construtivo - Subestações Grande Sertão 14-7-2026.html`
- `Fornecimento - Subestações Grande Sertão 13-07-2026.html`

## O que precisa ser feito

### 1. Backend API (Node.js/Express ou Python FastAPI)
Criar uma API REST que conecta no TiDB e permite CRUD:

```
GET  /api/fornecimento       → lista completa
PUT  /api/fornecimento/:id   → atualiza status/fornecedor/data
GET  /api/construtivo        → lista progresso
PUT  /api/construtivo/:id    → atualiza progresso/status
GET  /api/stats              → estatísticas resumidas
```

### 2. Dashboards Dinâmicos
Converter os HTMLs para carregar dados da API em vez de ter dados estáticos:
- Tabelas renderizadas via JavaScript (fetch API)
- Células clicáveis para edição inline
- Select dropdown para status (Entregue, Em fabricação, Em estoque, etc.)
- Salvamento automático via PUT

### 3. Autenticação (básica)
- Tela de login simples para edição
- Visualização pública sem login
- Edição protegida por senha compartilhada

### 4. Deploy
- Backend API no Render (Node.js Web Service)
- Frontend no GitHub Pages ou no próprio Render
- GitHub Action para exportar dados periodicamente

## Credenciais TiDB
- Host: `gateway01.sa-east-1.prod.aws.tidbcloud.com`
- Porta: 4000
- User: `gy5yMNEFDCFn2XC.root`
- Password: `kdqT4cU2noPfVuZ5`
- Database: `gste_relatorios`

## Tabelas já criadas
- `projetos` (id, nome, codigo, descricao)
- `equipamentos` (id, nome, categoria)
- `fornecimento` (projeto_id, equipamento_id, fornecedor, quantidade, status, data_prevista)
- `progresso_construtivo` (projeto_id, equipamento_id, progresso, status, data_atualizacao)

## Render
- Dashboard: https://dashboard.render.com/web/srv-d9j8dj4vikkc73dkisg0
- Deploy Hook: `https://api.render.com/deploy/srv-d9j8dj4vikkc73dkisg0?key=6yW5Hno3LkE`
- Build Command: `npm install`
- Start Command: `npx serve -s . -l $PORT`