#!/usr/bin/env python3
"""
Script para testar as páginas HTML localmente
"""
import http.server
import socketserver
import webbrowser
import threading
import time
import os

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="/Users/lucianograndesertao/Relatorios-de-Engenharia-GSTE", **kwargs)

def start_server():
    """Inicia o servidor HTTP"""
    port = 8080
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"Servidor HTTP rodando na porta {port}")
        print(f"Acesse as páginas em:")
        print(f"  - Página principal: http://localhost:{port}/")
        print(f"  - Dashboard Fornecimento: http://localhost:{port}/Fornecimento-SubestacoesGrandeSertao.html")
        print(f"  - Dashboard Construtivo: http://localhost:{port}/DashboardConstrutivo-SubestacoesGrandeSertao.html")
        print("\nPressione Ctrl+C para parar o servidor")
        httpd.serve_forever()

def open_browser():
    """Abre o navegador após um pequeno delay"""
    time.sleep(2)  # Espera o servidor iniciar
    webbrowser.open("http://localhost:8080/")

if __name__ == "__main__":
    # Inicia o servidor em uma thread separada
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Abre o navegador
    open_browser()
    
    # Mantém o script rodando
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServidor parado")