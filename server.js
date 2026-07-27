const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// TiDB connection pool
const pool = mysql.createPool({
  host: process.env.TIDB_HOST || 'gateway01.sa-east-1.prod.aws.tidbcloud.com',
  port: parseInt(process.env.TIDB_PORT || '4000'),
  user: process.env.TIDB_USER || 'gy5yMNEFDCFn2XC.root',
  password: process.env.TIDB_PASSWORD || 'kdqT4cU2noPfVuZ5',
  database: process.env.TIDB_DATABASE || 'gste_relatorios',
  ssl: { ca: process.env.TIDB_CA || '/etc/ssl/cert.pem' },
  waitForConnections: true,
  connectionLimit: 10,
});

// ========== FORNECIMENTO ==========

// Lista completa
app.get('/api/fornecimento', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT f.id, p.nome AS projeto, p.codigo, e.nome AS equipamento,
             f.fornecedor, f.quantidade, f.status, f.data_prevista, f.observacao
      FROM fornecimento f
      JOIN projetos p ON f.projeto_id = p.id
      JOIN equipamentos e ON f.equipamento_id = e.id
      ORDER BY p.id, e.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar registro
app.put('/api/fornecimento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fornecedor, quantidade, status, data_prevista, observacao } = req.body;
    await pool.query(
      `UPDATE fornecimento SET fornecedor=?, quantidade=?, status=?, data_prevista=?, observacao=?
       WHERE id=?`,
      [fornecedor, quantidade, status, data_prevista, observacao, id]
    );
    const [rows] = await pool.query('SELECT * FROM fornecimento WHERE id=?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CONSTRUTIVO ==========

// Lista progresso construtivo
app.get('/api/construtivo', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT pc.id, p.nome AS projeto, p.codigo, e.nome AS equipamento,
             pc.progresso, pc.status, pc.data_atualizacao, pc.observacao
      FROM progresso_construtivo pc
      JOIN projetos p ON pc.projeto_id = p.id
      JOIN equipamentos e ON pc.equipamento_id = e.id
      ORDER BY p.id, e.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar progresso
app.put('/api/construtivo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { progresso, status, data_atualizacao, observacao } = req.body;
    await pool.query(
      `UPDATE progresso_construtivo SET progresso=?, status=?, data_atualizacao=?, observacao=?
       WHERE id=?`,
      [progresso, status, data_atualizacao, observacao, id]
    );
    const [rows] = await pool.query('SELECT * FROM progresso_construtivo WHERE id=?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== STATS ==========
app.get('/api/stats', async (req, res) => {
  try {
    const [proj] = await pool.query('SELECT COUNT(*) as total FROM projetos');
    const [eq] = await pool.query('SELECT COUNT(*) as total FROM equipamentos');
    const [forn] = await pool.query('SELECT COUNT(*) as total FROM fornecimento');
    const [cons] = await pool.query('SELECT COUNT(*) as total FROM progresso_construtivo');
    const [statusCount] = await pool.query(
      'SELECT status, COUNT(*) as total FROM fornecimento GROUP BY status ORDER BY total DESC'
    );
    res.json({
      projetos: proj[0].total,
      equipamentos: eq[0].total,
      fornecimento: forn[0].total,
      construtivo: cons[0].total,
      status_count: statusCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== AUTH ==========
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  const valid = process.env.EDIT_PASSWORD || 'gste2026';
  if (password === valid) {
    res.json({ token: 'authorized', success: true });
  } else {
    res.status(401).json({ error: 'Senha inválida' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ API rodando na porta ${PORT}`);
  console.log(`   TiDB: ${process.env.TIDB_HOST || 'gateway01...'}`);
});