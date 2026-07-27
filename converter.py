#!/usr/bin/env python3
"""Converte dashboards HTML: remove JS antigo, mantém CSS e ícones, adiciona carregamento do data.json"""
import re, os

def converter_fornecimento(origem, destino):
    with open(origem, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()
    
    # 1. Extrair CSS (primeiro bloco <style>)
    css_match = re.search(r'<style>.*?</style>', html, re.DOTALL)
    css = css_match.group() if css_match else ''
    
    # 2. Extrair HTML até o primeiro <script> (estrutura da página)
    first_script = html.find('<script>')
    page_html = html[:first_script]
    
    # 3. Extrair iconUrls do script original
    icon_match = re.search(r'(const iconUrls|var iconUrls)\s*=\s*\{.*?\};', html, re.DOTALL)
    icon_data = icon_match.group() if icon_match else 'const iconUrls = {};'
    
    # 4. Extrair HTML depois do último </script> até </html>
    last_script_close = html.rfind('</script>') + 9
    end_html = html[last_script_close:]
    
    # 5. Construir novo HTML
    js_code = '''
<script>
''' + icon_data + '''

async function carregarDados() {
    try {
        const resp = await fetch('data.json?_=' + Date.now());
        const data = await resp.json();
        const records = data.fornecimento || [];
        
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
            return '<span class="status-badge" style="background:' + bg + '">' + status + '</span>';
        }
        
        const tabelas = [
            { id: 'gs1MainBody', projeto: 'Projeto Grande Sertão 1' },
            { id: 'gs1AuxBody',  projeto: 'Projeto Grande Sertão 1' },
            { id: 'gs2MainBody', projeto: 'Projeto Grande Sertão 2' },
            { id: 'gs2AuxBody',  projeto: 'Projeto Grande Sertão 2' },
            { id: 'taesaMainBody', projeto: 'Projeto Grande Sertão 2' },
            { id: 'taesaAuxBody',  projeto: 'Projeto Grande Sertão 2' },
            { id: 'gs3MainBody', projeto: 'Projeto Grande Sertão 3' },
            { id: 'gs3AuxBody',  projeto: 'Projeto Grande Sertão 3' },
        ];
        
        tabelas.forEach(t => {
            const tbody = document.getElementById(t.id);
            if (!tbody) return;
            
            const projRecs = records.filter(r => r.projeto === t.projeto);
            const table = tbody.closest('table');
            const headers = table ? table.querySelectorAll('thead th:not(:first-child)') : [];
            const substations = Array.from(headers).map(th => th.textContent.trim());
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
</script>
'''
    
    novo_html = page_html + js_code + '\n' + end_html
    
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(novo_html)
    
    print(f'✅ {destino} convertido!')
    print(f'   Tamanho original: {len(html)} bytes')
    print(f'   Novo tamanho: {len(novo_html)} bytes')

if __name__ == '__main__':
    dir_path = '/tmp/Relatorios-de-Engenharia-GSTE'
    src = os.path.join(dir_path, 'Fornecimento-SubestacoesGrandeSertao.html')
    converter_fornecimento(src, src)