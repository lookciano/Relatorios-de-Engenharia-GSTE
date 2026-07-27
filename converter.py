#!/usr/bin/env python3
"""Converte dashboards HTML estáticos para dinâmicos, mantendo o design original"""
import re, os

ARQUIVOS = {
    'Fornecimento-SubestacoesGrandeSertao.html': {
        'tabelas': [
            ('gs1MainBody', 'Projeto Grande Sertão 1', 'Equipamentos Principais'),
            ('gs1AuxBody',  'Projeto Grande Sertão 1', 'Equipamentos de Serviço Auxiliar'),
            ('gs2MainBody', 'Projeto Grande Sertão 2', 'Equipamentos Principais'),
            ('gs2AuxBody',  'Projeto Grande Sertão 2', 'Equipamentos de Serviço Auxiliar'),
            ('taesaMainBody', 'Projeto Grande Sertão 2', 'Equipamentos Principais'),
            ('taesaAuxBody',  'Projeto Grande Sertão 2', 'Equipamentos de Serviço Auxiliar'),
            ('gs3MainBody', 'Projeto Grande Sertão 3', 'Equipamentos Principais'),
            ('gs3AuxBody',  'Projeto Grande Sertão 3', 'Equipamentos de Serviço Auxiliar'),
        ]
    }
}

def converter_fornecimento(origem, destino):
    with open(origem, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()
    
    # Extrair o script de ícones (preservar intacto)
    script_start = html.find('<script>')
    script_end = html.find('</script>', script_start) + 9
    icon_script = html[script_start:script_end]
    
    # JS template para gerar linhas dinamicamente
    tabelas_js = '''
// ===== DADOS DINÂMICOS =====
async function carregarDados() {
    try {
        const resp = await fetch('data.json?_=' + Date.now());
        const data = await resp.json();
        const records = data.fornecimento || [];
        
        // Mapeamento: nome do equipamento → icon class
        const equipIcons = Object.keys(iconUrls);
        
        function getIcon(eqName) {
            const key = Object.keys(iconUrls).find(k => 
                eqName.toLowerCase().includes(k.toLowerCase())
            );
            return key ? iconUrls[key] : iconUrls[Object.keys(iconUrls)[0]];
        }
        
        function statusBadge(status) {
            const colors = {
                'Entregue': '#10b981',
                'Entregue parcial': '#f59e0b',
                'Em fabricação': '#3b82f6',
                'Em estoque': '#8b5cf6',
                'Em transporte': '#ec4899',
                'TAF Concluído': '#14b8a6',
                'TAF em andamento': '#f97316',
                'Pendente': '#6b7280',
            };
            const bg = colors[status] || '#6b7280';
            return `<span class="status-badge" style="background:${bg}">${status}</span>`;
        }
        
        const tabelas = [
            { id: 'gs1MainBody', projeto: 'Projeto Grande Sertão 1', secao: 'Equipamentos Principais' },
            { id: 'gs1AuxBody',  projeto: 'Projeto Grande Sertão 1', secao: 'Equipamentos de Serviço Auxiliar' },
            { id: 'gs2MainBody', projeto: 'Projeto Grande Sertão 2', secao: 'Equipamentos Principais' },
            { id: 'gs2AuxBody',  projeto: 'Projeto Grande Sertão 2', secao: 'Equipamentos de Serviço Auxiliar' },
            { id: 'taesaMainBody', projeto: 'Projeto Grande Sertão 2', secao: 'TAESA (dentro de GS2) Equipamentos Principais' },
            { id: 'taesaAuxBody',  projeto: 'Projeto Grande Sertão 2', secao: 'TAESA (dentro de GS2) Equipamentos de Serviço Auxiliar' },
            { id: 'gs3MainBody', projeto: 'Projeto Grande Sertão 3', secao: 'Equipamentos Principais' },
            { id: 'gs3AuxBody',  projeto: 'Projeto Grande Sertão 3', secao: 'Equipamentos de Serviço Auxiliar' },
        ];
        
        tabelas.forEach(t => {
            const tbody = document.getElementById(t.id);
            if (!tbody) return;
            
            // Get unique equipments for this project/section combo
            const projRecs = records.filter(r => r.projeto === t.projeto);
            
            // Determine which substations are in this section based on thead
            const table = tbody.closest('table');
            const headers = table ? table.querySelectorAll('thead th:not(:first-child)') : [];
            const substations = Array.from(headers).map(th => th.textContent.trim());
            
            // Get equipments that appear in the data for this section
            // Use the observacao field to determine section
            const secRecs = projRecs.filter(r => 
                (r.observacao && r.observacao.includes('Equipamentos Principais')) === 
                t.secao.includes('Equipamentos Principais')
            );
            
            const equipments = [...new Set(projRecs.map(r => r.equipamento))];
            
            let html = '';
            equipments.forEach(eq => {
                html += '<tr><td>';
                html += '<div class="equipment-cell">';
                html += '<div class="equipment-icon"><img src="' + getIcon(eq) + '" alt=""></div>';
                html += '<div class="equipment-name">' + eq + '</div>';
                html += '</div></td>';
                
                substations.forEach(sub => {
                    const rec = projRecs.find(r => r.equipamento === eq && r.fornecedor === sub);
                    if (rec) {
                        html += '<td><div class="supplier-cell">';
                        html += '<div class="cell-content">';
                        html += '<div style="margin-bottom:0.3rem">' + statusBadge(rec.status) + '</div>';
                        html += '<div class="date">' + (rec.data_prevista || '—') + '</div>';
                        html += '<div class="quantity-section">';
                        html += '<span class="quantity">' + rec.quantidade + '</span>';
                        html += '<span class="quantity-total"></span>';
                        html += '</div></div></div></td>';
                    } else {
                        html += '<td>—</td>';
                    }
                });
                html += '</tr>';
            });
            tbody.innerHTML = html;
        });
    } catch(e) {
        console.error('Erro ao carregar dados:', e);
    }
}
document.addEventListener('DOMContentLoaded', carregarDados);
'''
    
    # Substituir conteúdo de cada tbody
    for tbody_id, _, _ in ARQUIVOS['Fornecimento-SubestacoesGrandeSertao.html']['tabelas']:
        pattern = r'(<tbody[^>]*id="' + tbody_id + r'"[^>]*>).*?(</tbody>)'
        replacement = r'\1' + '\n' + r'\2'
        html = re.sub(pattern, replacement, html, flags=re.DOTALL)
    
    # Injetar JS antes do fechamento </body>
    js_block = '\n<script>\n' + icon_script + '\n' + tabelas_js + '\n</script>\n'
    html = html.replace('</body>', js_block + '</body>')
    
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f'✅ {destino} convertido!')

if __name__ == '__main__':
    dir_path = '/tmp/Relatorios-de-Engenharia-GSTE'
    src = os.path.join(dir_path, 'Fornecimento-SubestacoesGrandeSertao.html')
    dst = os.path.join(dir_path, 'Fornecimento-SubestacoesGrandeSertao.html')
    # Backup
    os.rename(src, src + '.bak')
    converter_fornecimento(src + '.bak', dst)