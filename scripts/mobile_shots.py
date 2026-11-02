#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Скриншоты мобильных режимов для визуальной проверки чанка «мобилка».
Запуск: python3 scripts/mobile_shots.py  → /tmp/render/mobile_*.png"""
import os, subprocess, sys, time, socket
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8015
URL = f"http://127.0.0.1:{PORT}/index.html"
FORCE_COARSE = open(os.path.join(ROOT, "scripts", "mobile_check.py"), encoding="utf-8").read().split('FORCE_COARSE = """')[1].split('"""')[0]

def main():
    from playwright.sync_api import sync_playwright
    server = subprocess.Popen([sys.executable, os.path.join(ROOT, "scripts", "serve_dev.py"), str(PORT)],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(0.7)
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            os.makedirs("/tmp/render", exist_ok=True)
            # ландшафт: иммерсивный + щипок
            ctx = b.new_context(viewport={"width": 812, "height": 375}, device_scale_factor=2, has_touch=True)
            p = ctx.new_page(); p.add_init_script(FORCE_COARSE); p.goto(URL); p.wait_for_timeout(500)
            p.screenshot(path="/tmp/render/mobile_landscape.png")
            pe = lambda t, i, x, y: p.evaluate("([t,id,x,y])=>document.getElementById('game-canvas').dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch',isPrimary:id===9}))", [t,i,x,y])
            pe("pointerdown", 9, 250, 190); pe("pointerdown", 10, 420, 190)
            for i in range(1, 7):
                pe("pointermove", 9, 250 - i * 18, 190); pe("pointermove", 10, 420 + i * 25, 190)
            pe("pointerup", 9, 142, 190); pe("pointerup", 10, 570, 190)
            p.wait_for_timeout(400)
            p.screenshot(path="/tmp/render/mobile_landscape_zoom.png")
            ctx.close()
            # портрет: поток
            ctx2 = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
            p2 = ctx2.new_page(); p2.add_init_script(FORCE_COARSE); p2.goto(URL); p2.wait_for_timeout(500)
            p2.evaluate("document.getElementById('rotate-dismiss') && document.getElementById('rotate-dismiss').click()")
            p2.wait_for_timeout(200)
            p2.screenshot(path="/tmp/render/mobile_portrait.png")
            ctx2.close()
            b.close()
    finally:
        server.terminate()
    print("скриншоты: /tmp/render/mobile_*.png")

if __name__ == "__main__":
    sys.exit(main())
