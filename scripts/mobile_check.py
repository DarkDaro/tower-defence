#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка мобильного вида «Цитадели Орды» (чанк «мобилка: зум и панорама»).

Три контекста headless-Chromium:
  A. ландшафтный телефон 812x375, тач — иммерсивный режим: поле по ширине (cover),
     щипок увеличивает канву, палец двигает панораму, жест не строит башню;
  B. портретный телефон 390x844, тач — портрет-поток: высота контейнера поля
     фиксирована, зум работает внутри, клик по клетке строит;
  C. десктоп 1440x900 без тача — регресс: как было, «contain», без классов.
  D. сейв: сломанный localStorage (приватный режим), мусор и сейвы без версии/с
     битыми башнями — игра стартует, цикл живёт, валидация бракует мусор.

Запуск:  python3 scripts/mobile_check.py [порт]   (сервер поднимается сам)
"""
import os
import socket
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8014
URL = f"http://127.0.0.1:{PORT}/index.html"

# pointer: coarse включаем принудительно — headless-флаги Playwright не гарантируют media
FORCE_COARSE = """
(() => {
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (q) => {
    if (q === '(pointer: coarse)') {
      return { matches: true, media: q, onchange: null,
               addEventListener() {}, removeEventListener() {},
               addListener() {}, removeListener() {}, dispatchEvent() { return false; } };
    }
    return orig(q);
  };
})();
"""

def free_port(p):
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", p)); return True
        except OSError:
            return False

def main():
    from playwright.sync_api import sync_playwright

    if not free_port(PORT):
        print(f"Порт {PORT} занят"); return 1
    server = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "scripts", "serve_dev.py"), str(PORT)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    failures = []
    try:
        time.sleep(0.7)
        with sync_playwright() as pw:
            browser = pw.chromium.launch()

            def new_page(w, h, touch, coarse):
                ctx = browser.new_context(viewport={"width": w, "height": h},
                                          device_scale_factor=2, has_touch=touch)
                page = ctx.new_page()
                errors = []
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                if coarse:
                    page.add_init_script(FORCE_COARSE)
                page.goto(URL)
                page.wait_for_timeout(400)
                return page, ctx, errors

            # ---------- A. Ландшафтный телефон: иммерсивный режим ----------
            page, ctx, errors = new_page(812, 375, touch=True, coarse=True)
            g = lambda js: page.evaluate(js)

            if not g("document.body.classList.contains('immersive')"):
                failures.append("A: нет класса immersive на тач-ландшафте")
            if not g("document.getElementById('game-canvas').parentElement.classList.contains('panzoom')"):
                failures.append("A: контейнер без panzoom")

            # computed-стили: синтетические PointerEvent идут мимо touch-action,
            # поэтому правила панорамы проверяем только по computed-style
            ta_clip = g("getComputedStyle(document.getElementById('game-canvas').parentElement).touchAction")
            ta_canvas = g("getComputedStyle(document.getElementById('game-canvas')).touchAction")
            ov_clip = g("getComputedStyle(document.getElementById('game-canvas').parentElement).overflow")
            if ta_clip != 'none':
                failures.append(f"A: touch-action клипа = {ta_clip!r}, ждали none (мёртвое CSS-правило?)")
            if ta_canvas != 'none':
                failures.append(f"A: touch-action канвы = {ta_canvas!r}, ждали none")
            if ov_clip != 'hidden':
                failures.append(f"A: overflow клипа = {ov_clip!r}, ждали hidden (канва вылезет из окна)")

            cw = g("document.getElementById('game-canvas').parentElement.clientWidth")
            ch = g("document.getElementById('game-canvas').parentElement.clientHeight")
            rw = g("document.getElementById('game-canvas').getBoundingClientRect().width")
            rh = g("document.getElementById('game-canvas').getBoundingClientRect().height")
            # cover: канва по ширине контейнера, высота больше контейнера (кроп)
            if abs(rw - cw) > 3:
                failures.append(f"A: cover по ширине не сработал (canva {rw:.0f} vs контейнер {cw})")
            if rh <= ch:
                failures.append(f"A: высота канвы {rh:.0f} не перекрывает контейнер {ch} — нет кропа")

            bw = g("document.getElementById('game-canvas').width")
            if not (1400 <= bw <= 1700):  # 1792*0.4464*2 ≈ 1600
                failures.append(f"A: буфер канвы {bw} — неожиданный (ожидали ~1600, dprCapTouch=2)")

            # щипок: два пальца расходятся — канва растёт
            def ptr(etype, pid, x, y):
                page.evaluate(
                    """([t, id, x, y]) => {
                        const c = document.getElementById('game-canvas');
                        c.dispatchEvent(new PointerEvent(t, {pointerId: id, clientX: x, clientY: y,
                            bubbles: true, pointerType: 'touch', isPrimary: id === 9}));
                    }""", [etype, pid, x, y])

            w0 = rw
            ptr("pointerdown", 9, 300, 180); ptr("pointerdown", 10, 400, 180)
            for i in range(1, 6):  # раздвигаем до 300/560
                ptr("pointermove", 9, 300 - i * 12, 180)
                ptr("pointermove", 10, 400 + i * 32, 180)
            ptr("pointerup", 9, 240, 180); ptr("pointerup", 10, 560, 180)
            page.wait_for_timeout(300)  # резкий буфер после жеста
            w1 = g("document.getElementById('game-canvas').getBoundingClientRect().width")
            tr = g("document.getElementById('game-canvas').style.transform")
            if w1 <= w0 + 40:
                failures.append(f"A: щипок не увеличил канву ({w0:.0f} → {w1:.0f})")
            if "translate" not in tr:
                failures.append("A: transform панорамы не выставлен")
            bw1 = g("document.getElementById('game-canvas').width")
            if bw1 <= bw:
                failures.append(f"A: буфер не пересчитан после зума ({bw} → {bw1})")

            # жест панорамы не должен строить башню: клик сразу после движения гасится
            page.evaluate("document.querySelector('.tower-btn[data-type=archer]').dispatchEvent(new MouseEvent('click', {bubbles: true}))")
            gold0 = g("__TD.state.gold")
            page.evaluate("""(() => {
                const c = document.getElementById('game-canvas');
                c.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 9, clientX: 400, clientY: 180, bubbles: true, pointerType: 'touch'}));
                c.dispatchEvent(new PointerEvent('pointermove', {pointerId: 9, clientX: 460, clientY: 200, bubbles: true, pointerType: 'touch'}));
                c.dispatchEvent(new PointerEvent('pointerup', {pointerId: 9, clientX: 460, clientY: 200, bubbles: true, pointerType: 'touch'}));
                c.dispatchEvent(new MouseEvent('click', {clientX: 460, clientY: 200, bubbles: true}));
            })()""")
            tw_after_drag = g("__TD.state.tw.length")
            if tw_after_drag != 0:
                failures.append("A: панорама построила башню — гашение клика не работает")

            # чистый тап по клетке строит (координаты через rect с учётом pan)
            page.wait_for_timeout(400)  # гашение истекло
            built = page.evaluate("""(() => {
                const c = document.getElementById('game-canvas');
                const r = c.getBoundingClientRect();
                const fx = 4.5 * 56, fy = 5.5 * 56; // центр клетки (4,5) — не дорога, не занято
                const x = r.left + fx / 1792 * r.width, y = r.top + fy / 1008 * r.height;
                c.dispatchEvent(new MouseEvent('click', {clientX: x, clientY: y, bubbles: true}));
                return __TD.state.tw;
            })()""")
            if not built or built[0][0] != 4 or built[0][1] != 5:
                failures.append(f"A: тап по клетке (4,5) не построил башню: {built}")
            gold1 = g("__TD.state.gold")
            if gold1 >= gold0:
                failures.append(f"A: золото не списано за постройку ({gold0} → {gold1})")

            # ---------- B. Портретный телефон: поток + зум внутри контейнера ----------
            page2, ctx2, errors2 = new_page(390, 844, touch=True, coarse=True)
            g2 = lambda js: page2.evaluate(js)
            if g2("document.body.classList.contains('immersive')"):
                failures.append("B: immersive в портрет-потоке не должен включаться")
            boxh = g2("document.getElementById('game-canvas').parentElement.style.height")
            if not boxh or not boxh.endswith("px"):
                failures.append(f"B: высота контейнера поля не зафиксирована ({boxh!r})")
            ph = g2("document.getElementById('game-canvas').parentElement.clientHeight")
            rw2 = g2("document.getElementById('game-canvas').getBoundingClientRect().width")
            if rw2 > 392:
                failures.append(f"B: канва шире окна в портрете ({rw2:.0f})")
            # зум внутри контейнера: высота контейнера не меняется, канва растёт
            ptr2 = lambda *a: page2.evaluate(
                """([t, id, x, y]) => document.getElementById('game-canvas')
                    .dispatchEvent(new PointerEvent(t, {pointerId: id, clientX: x, clientY: y,
                    bubbles: true, pointerType: 'touch', isPrimary: id === 9}))""", list(a))
            ptr2("pointerdown", 9, 120, 400); ptr2("pointerdown", 10, 240, 400)
            for i in range(1, 6):
                ptr2("pointermove", 9, 120 - i * 15, 400)
                ptr2("pointermove", 10, 240 + i * 15, 400)
            ptr2("pointerup", 9, 45, 400); ptr2("pointerup", 10, 315, 400)
            page2.wait_for_timeout(300)
            rw3 = g2("document.getElementById('game-canvas').getBoundingClientRect().width")
            if rw3 <= rw2 + 30:
                failures.append(f"B: щипок в портрете не увеличил канву ({rw2:.0f} → {rw3:.0f})")
            ph2 = g2("document.getElementById('game-canvas').parentElement.clientHeight")
            if abs(ph2 - ph) > 2:
                failures.append(f"B: контейнер распёрло зумом ({ph} → {ph2})")

            # ---------- C. Десктоп: регресс «как было» ----------
            page3, ctx3, errors3 = new_page(1440, 900, touch=False, coarse=False)
            g3 = lambda js: page3.evaluate(js)
            if g3("document.body.classList.contains('immersive')"):
                failures.append("C: immersive включился на десктопе")
            if g3("document.getElementById('game-canvas').parentElement.classList.contains('panzoom')"):
                failures.append("C: panzoom включился на десктопе")
            cw3 = g3("document.getElementById('game-canvas').getBoundingClientRect().width")
            if abs(cw3 - (1440 - 24)) > 3:  # contain: min((1440-24)/1792,(900-24)/1008)*1792 = 1416
                failures.append(f"C: десктопная вписывание изменилась ({cw3:.0f} вместо 1416)")

            # ---------- D. Сейв: битый localStorage и битые сейвы не роняют игру ----------
            # D1: setItem всегда бросает (приватный режим Safari) + мусор вместо сейва:
            # игра стартует на дефолтах, цикл живёт, saveGame из клика не даёт ошибок
            ctx4 = browser.new_context(viewport={"width": 1280, "height": 800})
            page4 = ctx4.new_page()
            errors4 = []
            page4.on("pageerror", lambda e: errors4.append(str(e)))
            page4.on("console", lambda m: errors4.append(m.text) if m.type == "error" else None)
            page4.add_init_script("""
                try { localStorage.setItem('td_save', 'not-json{'); } catch (e) {}
                Storage.prototype.setItem = function() { throw new Error('QuotaExceededError'); };
            """)
            page4.goto(URL)
            page4.wait_for_timeout(400)
            g4 = lambda js: page4.evaluate(js)
            if g4("__TD.state.gold") != 200:
                failures.append(f"D1: мусорный сейв не отброшен, gold={g4('__TD.state.gold')}")
            f0 = g4("__TD.state.frames"); page4.wait_for_timeout(400); f1 = g4("__TD.state.frames")
            if f1 <= f0:
                failures.append("D1: игровой цикл умер (frames не тикают) при сломанном localStorage")
            page4.evaluate("document.getElementById('pause-btn').click()")  # setPaused → saveGame с бросающим setItem
            page4.wait_for_timeout(200)
            f2 = g4("__TD.state.frames"); page4.wait_for_timeout(300); f3 = g4("__TD.state.frames")
            if f3 <= f2:
                failures.append("D1: цикл умер после saveGame с бросающим setItem")
            for e in errors4:
                failures.append(f"D1: ошибка JS: {e[:200]}")

            # D2: сейв без версии схемы (v) — отбрасывается, не интерпретируется
            ctx5 = browser.new_context(viewport={"width": 1280, "height": 800})
            page5 = ctx5.new_page()
            errors5 = []
            page5.on("pageerror", lambda e: errors5.append(str(e)))
            page5.on("console", lambda m: errors5.append(m.text) if m.type == "error" else None)
            page5.add_init_script("localStorage.setItem('td_save', JSON.stringify({gold: 999, lives: 1, waveNum: 5, towers: []}));")
            page5.goto(URL)
            page5.wait_for_timeout(400)
            if page5.evaluate("__TD.state.gold") != 200 or page5.evaluate("__TD.state.wave") != 0:
                failures.append(f"D2: сейв без версии прочитан (gold={page5.evaluate('__TD.state.gold')}, wave={page5.evaluate('__TD.state.wave')})")

            # D3: валидный сейв v:1 грузится, битые башни (неизвестный тип, уровень 9,
            # клетка вне поля) бракуются валидацией — без NaN-урона и исключений.
            # Отдельный контекст: add_init_script перезапускается на reload и затёр бы сейв
            ctx6 = browser.new_context(viewport={"width": 1280, "height": 800})
            page6 = ctx6.new_page()
            errors6 = []
            page6.on("pageerror", lambda e: errors6.append(str(e)))
            page6.on("console", lambda m: errors6.append(m.text) if m.type == "error" else None)
            page6.goto(URL)
            page6.wait_for_timeout(300)
            page6.evaluate("""localStorage.setItem('td_save', JSON.stringify({v: 1, gold: 500, lives: 15, waveNum: 3, mana: 100,
                towers: [{col:4,row:5,type:'archer',level:2}, {col:7,row:7,type:'pirate',level:2},
                         {col:7,row:7,type:'archer',level:9}, {col:99,row:1,type:'archer',level:1}]}))""")
            page6.reload()
            page6.wait_for_timeout(400)
            if page6.evaluate("__TD.state.gold") != 500:
                failures.append(f"D3: валидный сейв не загружен (gold={page6.evaluate('__TD.state.gold')})")
            tw = page6.evaluate("__TD.state.tw")
            if tw != [[4, 5, "archer"]]:
                failures.append(f"D3: валидация башен сломана: {tw} (ждали [[4,5,'archer']])")
            for e in errors6:
                failures.append(f"D3: ошибка JS: {e[:200]}")
            ctx4.close(); ctx5.close(); ctx6.close()

            for name, errs in (("A", errors), ("B", errors2), ("C", errors3)):
                for e in errs:
                    failures.append(f"{name}: ошибка JS в консоли: {e[:200]}")

            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except Exception:
            server.kill()

    if failures:
        print("МОБИЛЬНАЯ ПРОВЕРКА КРАСНАЯ:")
        for f in failures:
            print("  FAIL:", f)
        return 1
    print("МОБИЛЬНАЯ ПРОВЕРКА ЗЕЛЁНАЯ: cover/зум/панорама/гашение клика/портрет/десктоп-регресс — ок")
    return 0

if __name__ == "__main__":
    sys.exit(main())
