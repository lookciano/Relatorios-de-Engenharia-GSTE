#!/usr/bin/env python3
"""Exporta dados do TiDB para JSON (usado pelo GitHub Pages)"""
import pymysql, json, os
from datetime import datetime, date
from pymysql.cursors import DictCursor

DB_CONFIG = {
    'host': os.environ.get('TIDB_HOST', 'gateway01.sa-east-1.prod.aws.tidbcloud.com'),
    'port': int(os.environ.get('TIDB_PORT', '4000')),
    'user': os.environ.get('TIDB_USER', 'gy5yMNEFDCFn2XC.root'),
    'password': os.environ.get('TIDB_PASSWORD', 'kdqT4cU2noPfVuZ5'),
    'database': os.environ.get('TIDB_DATABASE', 'gste_relatorios'),
    'ssl': {'ca': '/etc/ssl/cert.pem'},
    'connect_timeout': 15
}

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

def export_data():
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor(DictCursor)
    
    cur.execute('SELECT * FROM projetos')
    projetos = cur.fetchall()
    
    cur.execute('SELECT * FROM equipamentos')
    equipamentos = cur.fetchall()
    
    cur.execute('''
        SELECT f.id, p.nome AS projeto, p.codigo, e.nome AS equipamento,
               f.fornecedor, f.quantidade, f.status, f.data_prevista, f.observacao
        FROM fornecimento f
        JOIN projetos p ON f.projeto_id = p.id
        JOIN equipamentos e ON f.equipamento_id = e.id
        ORDER BY p.id, e.id
    ''')
    fornecimento = cur.fetchall()
    
    stats = {
        'total_projetos': len(projetos),
        'total_equipamentos': len(equipamentos),
        'total_registros': len(fornecimento),
        'status_count': {}
    }
    for row in fornecimento:
        s = row['status']
        stats['status_count'][s] = stats['status_count'].get(s, 0) + 1
    
    cur.execute('''
        SELECT pc.id, p.nome AS projeto, e.nome AS equipamento,
               pc.progresso, pc.status, pc.data_atualizacao, pc.observacao
        FROM progresso_construtivo pc
        JOIN projetos p ON pc.projeto_id = p.id
        JOIN equipamentos e ON pc.equipamento_id = e.id
        ORDER BY p.id, e.id
    ''')
    progresso = cur.fetchall()
    conn.close()
    
    data = {
        'projetos': projetos,
        'equipamentos': equipamentos,
        'fornecimento': fornecimento,
        'progresso': progresso,
        'stats': stats,
        'exportado_em': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    path = os.path.join(OUTPUT_DIR, 'data.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, cls=DateTimeEncoder)
    print(f'✅ Dados exportados: {path}')
    print(f'   {len(projetos)} projetos, {len(equipamentos)} equipamentos, {len(fornecimento)} registros')

if __name__ == '__main__':
    export_data()