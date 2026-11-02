#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dev-сервер статики без кэширования: Cache-Control: no-cache на каждый ответ.

Зачем: голый `python3 -m http.server` не ставит Cache-Control, и браузер
удерживает старый js по эвристике Last-Modified — после правок кода можно
случайно играть и замерять СТАРУЮ версию (сейчас: забег волн в wave_run.py).
Запуск:  python3 scripts/serve_dev.py [порт]   (по умолчанию 8000)
"""
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    http.server.ThreadingHTTPServer(
        ('127.0.0.1', port), NoCacheHandler).serve_forever()
