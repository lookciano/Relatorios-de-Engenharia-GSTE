const express = require('express');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname);

// Configuração robusta de CORS e Headers preventores de Cache
app.use(cors());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.json({ limit: '50mb' }));

// ===== Configuração do TiDB Cloud =====
const DB_CONFIG = {
  host: process.env.TIDB_HOST || 'gateway01.sa-east-1.prod.aws.tidbcloud.com',
  port: parseInt(process.env.TIDB_PORT || '4000'),
  user: process.env.TIDB_USER || 'gy5yMNEFDCFn2XC.root',
  password: process.env.TIDB_PASSWORD || 'kdqT4cU2noPfVuZ5',
  database: process.env.TIDB_DATABASE || 'gste_relatorios',
  ssl: {
    // Carrega a CA padrão de sistemas Linux (Render) ou macOS para conexão segura SSL com o TiDB Cloud
    ca: fs.existsSync('/etc/ssl/cert.pem') ? fs.readFileSync('/etc/ssl/cert.pem') : undefined,
    rejectUnauthorized: false
  },
  connectTimeout: 15000
};

// Pool de conexão reuse-friendly
const pool = mysql.createPool(DB_CONFIG);

// ===== HELPER: Sincronização Relacional (TiDB gste_relatorios.fornecimento) =====
async function syncFornecimentoToRelational(stateJson) {
  try {
    const connection = await pool.getConnection();
    try {
      // Carrega mapeamento de projetos
      const [projs] = await connection.query('SELECT id, codigo FROM projetos');
      const projMap = {};
      projs.forEach(p => { projMap[p.codigo.toLowerCase()] = p.id; });

      // Carrega mapeamento de equipamentos
      const [eqs] = await connection.query('SELECT id, nome FROM equipamentos');
      const eqMap = {};
      eqs.forEach(e => { eqMap[e.nome.toLowerCase()] = e.id; });

      const state = JSON.parse(stateJson);

      await connection.beginTransaction();

      for (const [projKey, projVal] of Object.entries(state)) {
        const projId = projMap[projKey.toLowerCase()];
        if (!projId) continue;

        // Note: the clients save either { gs1: { equipment: [...] } } or { gs1: [...] } directly depending on the save method.
        // Let's support both structures gracefully!
        const equipmentArray = Array.isArray(projVal) ? projVal : (projVal.equipment || []);
        for (const eq of equipmentArray) {
          const eqId = eqMap[eq.name.toLowerCase()];
          if (!eqId) continue;

          const suppliersDict = eq.suppliers || {};
          for (const [supName, supData] of Object.entries(suppliersDict)) {
            const qty = parseInt(supData.delivered) || 0;
            const status = supData.status || 'N/A';
            const datePrev = supData.date || '';
            const obs = eq.category === 'principal' ? 'Equipamentos Principais' : 'Equipamentos Auxiliares';

            // Insere ou atualiza mantendo a integridade relacional
            await connection.query(`
              INSERT INTO fornecimento (projeto_id, equipamento_id, fornecedor, quantidade, status, data_prevista, observacao)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE quantidade = VALUES(quantidade), status = VALUES(status), data_prevista = VALUES(data_prevista)
            `, [projId, eqId, supName, qty, status, datePrev, obs]);
          }
        }
      }

      await connection.commit();
      console.log('✅ Sincronização relacional de fornecimento concluída com sucesso no TiDB Cloud!');
    } catch (err) {
      await connection.rollback();
      console.error('❌ Erro na transação relacional:', err.message);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ Erro ao conectar ao banco para sync relacional:', err.message);
  }
}

// ===== HELPER: Sincronização Relacional (TiDB gste_relatorios.progresso_construtivo) =====
async function syncConstrutivoToRelational(stateJson) {
  try {
    const connection = await pool.getConnection();
    try {
      // Carrega mapeamento de projetos
      const [projs] = await connection.query('SELECT id, codigo FROM projetos');
      const projMap = {};
      projs.forEach(p => { projMap[p.codigo.toLowerCase()] = p.id; });

      // Carrega mapeamento de equipamentos
      const [eqs] = await connection.query('SELECT id, nome FROM equipamentos');
      const eqMap = {};
      eqs.forEach(e => { eqMap[e.nome.toLowerCase()] = e.id; });

      const state = JSON.parse(stateJson);

      await connection.beginTransaction();

      for (const [projKey, projVal] of Object.entries(state)) {
        const projId = projMap[projKey.toLowerCase()];
        if (!projId) continue;

        // Na aba Construtivo do dashboard, temos 'engenharia', 'estruturas' e 'progresso'
        const engArray = projVal.engenharia || [];
        const estArray = projVal.estruturas || [];
        const progArray = projVal.progresso || [];

        // Vamos sincronizar progresso (vertical bar items) para a tabela progresso_construtivo do banco
        for (const item of progArray) {
          // Exemplo: { id: 'gs1-prog-cearamirim', supplier: 'Ceará Mirim', percentage: 95, label: 'Obra Civil' }
          // Mapeia 'Obra Civil' para equipamento 'Obra Civil' ou cria um genérico se necessário.
          // Procure por 'Obra Civil' ou 'Civil' no mapeamento de equipamentos
          let eqName = item.label || 'Obra Civil';
          let eqId = eqMap[eqName.toLowerCase()] || eqMap['cubículo']; // Fallback seguro
          
          const progressVal = parseFloat(item.percentage) || 0;
          const status = progressVal >= 100 ? 'Concluído' : (progressVal > 0 ? 'Em andamento' : 'Não iniciado');
          const obs = `Fornecedor/Subestação: ${item.supplier}`;

          await connection.query(`
            INSERT INTO progresso_construtivo (projeto_id, equipamento_id, progresso, status, data_atualizacao, observacao)
            VALUES (?, ?, ?, ?, CURDATE(), ?)
            ON DUPLICATE KEY UPDATE progresso = VALUES(progresso), status = VALUES(status), data_atualizacao = CURDATE()
          `, [projId, eqId, progressVal, status, obs]);
        }
      }

      await connection.commit();
      console.log('✅ Sincronização relacional de progresso construtivo concluída com sucesso!');
    } catch (err) {
      await connection.rollback();
      console.error('❌ Erro na transação relacional construtivo:', err.message);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ Erro ao conectar ao banco para sync relacional construtivo:', err.message);
  }
}

// ===== API de Sincronização em Tempo Real (TiDB Cloud) =====

// GET /sync/fornecimento - retorna dados salvos do TiDB Cloud
app.get('/sync/fornecimento', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT state_json FROM sync_states WHERE key_name = "fornecimento"');
    if (rows.length > 0) {
      return res.json(JSON.parse(rows[0].state_json));
    }
    res.json(null);
  } catch (e) {
    console.error('❌ Erro ao ler fornecimento do TiDB:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /sync/fornecimento - salva dados e sincroniza no TiDB Cloud em tempo real
app.post('/sync/fornecimento', async (req, res) => {
  try {
    // 1. Carrega o estado mestre atual do DB para fazer merge robusto
    const [rows] = await pool.query('SELECT state_json FROM sync_states WHERE key_name = "fornecimento"');
    let masterState = {};
    if (rows.length > 0) {
      try {
        masterState = JSON.parse(rows[0].state_json);
      } catch (err) {
        masterState = {};
      }
    }

    const clientData = req.body;
    
    // Faz o merge inteligente: se o cliente enviou uma lista direta do projeto ou um objeto com .equipment,
    // nós normalizamos para que o DB sempre mantenha a estrutura MASTER rica { gs1: { suppliers: [...], equipment: [...] } }
    for (const [projKey, projVal] of Object.entries(clientData)) {
      if (!masterState[projKey]) {
        masterState[projKey] = {
          suppliers: [],
          mainBodyId: projKey + 'MainBody',
          auxBodyId: projKey + 'AuxBody',
          equipment: []
        };
      }
      
      if (Array.isArray(projVal)) {
        masterState[projKey].equipment = projVal;
      } else if (projVal && typeof projVal === 'object') {
        if (projVal.equipment) {
          masterState[projKey].equipment = projVal.equipment;
        }
        if (projVal.suppliers) masterState[projKey].suppliers = projVal.suppliers;
        if (projVal.mainBodyId) masterState[projKey].mainBodyId = projVal.mainBodyId;
        if (projVal.auxBodyId) masterState[projKey].auxBodyId = projVal.auxBodyId;
      }
    }

    const stateJson = JSON.stringify(masterState);
    
    // Atualiza na tabela sync_states
    await pool.query(
      'INSERT INTO sync_states (key_name, state_json) VALUES ("fornecimento", ?) ON DUPLICATE KEY UPDATE state_json = ?',
      [stateJson, stateJson]
    );

    // 2. Executa sincronização assíncrona nas tabelas relacionais do banco em background (não bloqueia resposta rápida ao client)
    syncFornecimentoToRelational(stateJson).catch(err => {
      console.error('Erro em sync relacional background:', err.message);
    });

    res.json({ ok: true, timestamp: Date.now() });
  } catch (e) {
    console.error('❌ Erro ao salvar fornecimento no TiDB:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /sync/construtivo - retorna dados salvos do TiDB Cloud
app.get('/sync/construtivo', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT state_json FROM sync_states WHERE key_name = "construtivo"');
    if (rows.length > 0) {
      return res.json(JSON.parse(rows[0].state_json));
    }
    res.json(null);
  } catch (e) {
    console.error('❌ Erro ao ler construtivo do TiDB:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /sync/construtivo - salva dados e sincroniza no TiDB Cloud em tempo real
app.post('/sync/construtivo', async (req, res) => {
  try {
    const stateJson = JSON.stringify(req.body);

    // 1. Atualiza na tabela sync_states
    await pool.query(
      'INSERT INTO sync_states (key_name, state_json) VALUES ("construtivo", ?) ON DUPLICATE KEY UPDATE state_json = ?',
      [stateJson, stateJson]
    );

    // 2. Executa sincronização nas tabelas relacionais do banco em background
    syncConstrutivoToRelational(stateJson).catch(err => {
      console.error('Erro em sync relacional construtivo background:', err.message);
    });

    res.json({ ok: true, timestamp: Date.now() });
  } catch (e) {
    console.error('❌ Erro ao salvar construtivo no TiDB:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===== Servir arquivos estáticos =====
app.use((req, res, next) => {
  if (req.path.startsWith('/sync/')) return next();

  let filePath = path.join(PUBLIC, req.path);
  
  if (req.path.endsWith('.html') && fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  
  if (!path.extname(req.path)) {
    const htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  }
  
  const staticPath = path.join(PUBLIC, req.path);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return res.sendFile(staticPath);
  }
  
  if (req.path === '/' || req.path === '') {
    return res.sendFile(path.join(PUBLIC, 'index.html'));
  }
  
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor altamente disponível rodando na porta ${PORT}`);
});
