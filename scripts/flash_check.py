#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Живая проверка чанка «анимации атаки»: белая вспышка попадания у врагов
и отдача башен на выстреле.

Запуск: python3 scripts/flash_check.py [порт]
  - строит пару башен у дорожки (archer + cannon) через __TD.build,
  - ставит медленную скорость __TD.setSpeed(0.35), стартует волну,
  - снимает серию кадров и меряет долю «белых» пикселей в квадрате вокруг
    каждого врага (координаты из __TD.state.pos),
  - кадр срабатывания сохраняется в /tmp/render/flash_*.png.

Вспышка = белых пикселей у спрайта заметно больше, чем в спокойном кадре.
"""
import os
import subprocess
import sys
import time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8043
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = f"http://127.0.0.1:{PORT}/index.html"


def main():
    server = subprocess.Popen([sys.executable, os.path.join(ROOT, "scripts", "serve_dev.py"), str(PORT)],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(0.7)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            p = b.new_page(viewport={"width": 1280, "height": 720})
            p.goto(URL)
            p.wait_for_timeout(700)

            # геометрия канвы: game-координаты (VW×VH) -> пиксели страницы
            VW, VH = 1792, 1008
            rect = p.evaluate("() => { const r = document.getElementById('game-canvas').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
            sx, sy = rect[2] / VW, rect[3] / VH

            # башни у дорожки (клетки из плана w1_8): лучник + пушка, скорость 0.35 — вспышка 0.12с игры ≈ 0.34с экрана
            p.evaluate("__TD.setGold(600)")
            for t, c, r in (("archer", 5, 8), ("archer", 9, 8), ("cannon", 8, 11)):
                res = p.evaluate(f"__TD.build({c},{r},'{t}')")
                assert res is True, f"build {t} {c},{r} -> {res}"
            p.evaluate("__TD.setSpeed(1)")
            p.evaluate("() => document.getElementById('start-wave-btn') && document.getElementById('start-wave-btn').click()")
            # ждём, пока враги дойдут до зоны обстрела (иначе на 0.35x они не успевают за окно замера)
            tw = p.evaluate("__TD.state.tw")
            centers = [((c + 0.5) * 56, (r + 0.5) * 56) for c, r, _ in tw]
            engaged = False
            for _ in range(120):
                pos = p.evaluate("__TD.state.pos")
                if any(e[2] and any((e[0]-cx)**2 + (e[1]-cy)**2 <= 150**2 for cx, cy in centers) for e in pos):
                    engaged = True
                    break
                time.sleep(0.2)
            assert engaged, "враги не дошли до башен за 24с"
            p.evaluate("__TD.setSpeed(0.35)")  # вспышка 0.12с игры ≈ 0.34с экрана
            p.wait_for_timeout(200)

            os.makedirs("/tmp/render", exist_ok=True)
            shots = []
            kills0 = p.evaluate("__TD.state.kills")
            N = 40
            for i in range(N):
                pos = p.evaluate("__TD.state.pos")  # [x, y, alive] первых 5 врагов
                kills = p.evaluate("__TD.state.kills")
                png = f"/tmp/render/flash_{i:02d}.png"
                p.screenshot(path=png)
                shots.append((png, pos, kills))
                time.sleep(0.1)

            # метрика: белые пиксели в квадрате ±34px вокруг врага
            # строгая — чистый белый (min>235, разброс<14); мягкая — засветка (min>205, разброс<40)
            from PIL import Image
            per_frame, per_frame_soft = [], []
            for png, pos, kills in shots:
                im = Image.open(png).convert("RGB")
                whites = softs = 0
                for e in pos:
                    if not e[2]:
                        continue
                    cx, cy = rect[0] + e[0] * sx, rect[1] + e[1] * sy
                    box = im.crop((int(cx - 34), int(cy - 34), int(cx + 34), int(cy + 34)))
                    for px in box.getdata():
                        mn, mx = min(px), max(px)
                        if mn > 235 and (mx - mn) < 14:
                            whites += 1
                        if mn > 205 and (mx - mn) < 40:
                            softs += 1
                per_frame.append(whites)
                per_frame_soft.append(softs)

            print("киллы до/после:", kills0, "->", shots[-1][2])
            print("строгая:", per_frame)
            print("мягкая: ", per_frame_soft)
            peak = max(per_frame_soft)
            best_i = per_frame_soft.index(peak)
            med = sorted(per_frame_soft)[len(per_frame_soft) // 2]
            print(f"медиана(мяг)={med}, пик={peak} (кадр {best_i}), вспышка={'ДА' if peak >= max(80, med * 3) and peak > 0 else 'НЕТ'}")
            print("rect канвы:", rect)
            if peak > 0:
                print("кадр-доказательство:", shots[best_i][0])
            b.close()
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
