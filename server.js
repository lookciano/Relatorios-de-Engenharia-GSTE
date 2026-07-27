const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname);
const DATA_FILE = path.join(PUBLIC, 'server-data.json');

app.use(express.json({ limit: '50mb' }));

// ===== API de Sincronização =====

// Carregar dados do servidor
function loadServerData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Erro ao ler server-data.json:', e.message);
  }
  return { fornecimento: null, construtivo: null };
}

// Salvar dados no servidor
function saveServerData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /sync/fornecimento - retorna dados salvos
app.get('/sync/fornecimento', (req, res) => {
  const data = loadServerData();
  res.json(data.fornecimento || null);
});

// POST /sync/fornecimento - salva dados
app.post('/sync/fornecimento', (req, res) => {
  const data = loadServerData();
  data.fornecimento = req.body;
  saveServerData(data);
  res.json({ ok: true, timestamp: Date.now() });
});

// GET /sync/construtivo - retorna dados salvos
app.get('/sync/construtivo', (req, res) => {
  const data = loadServerData();
  res.json(data.construtivo || null);
});

// POST /sync/construtivo - salva dados
app.post('/sync/construtivo', (req, res) => {
  const data = loadServerData();
  data.construtivo = req.body;
  saveServerData(data);
  res.json({ ok: true, timestamp: Date.now() });
});

// ===== Servir arquivos estáticos =====
app.use((req, res, next) => {
  // Pula rotas de API
  if (req.path.startsWith('/sync/')) return next();

  let filePath = path.join(PUBLIC, req.path);
  
  if (req.path.endsWith('.html') && fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  
  if (!path.extname(req.path)) {
    const htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  }
  
  // Serve data.json for homepage stats
  const staticPath = path.join(PUBLIC, req.path);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return res.sendFile(staticPath);
  }
  
  // Root → index.html
  if (req.path === '/' || req.path === '') {
    return res.sendFile(path.join(PUBLIC, 'index.html'));
  }
  
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});