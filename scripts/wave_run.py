#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Бенчмарк-забег: волны подряд с планом застройки, замер жизней/золота/убийств по каждой волне.

Правила замера (чанк «баланс волн 1-3», сессия 5): решения по цифрам, один и тот же
протокол до/после. Стартовые 200 золота, дальше башни только на заработанное.

Подготовка:
  1) в корне репо:  python3 -m http.server 8000
  2) agent-browser open http://localhost:8000
  3) python3 scripts/wave_run.py --waves 8 --speed 3 --plan scripts/plan.json

План (JSON-список шагов, опционально):
  [{"after": 0, "build": [["archer", 4, 9], ["archer", 8, 9]], "up": []},
   {"after": 1, "build": [["archer", 16, 9]], "up": [[4, 9]]}]
  after = N  — применить после завершения волны N (0 = до старта первой волны).
Без плана играется голым стартом — тоже замер, просто больно.
"""
import argparse
import json
import re
import subprocess
import sys
import time

VW, VH = 1792, 1008  # только для справки; скрипту не нужны


def ev(js, timeout=60):
    r = subprocess.run(["agent-browser", "eval", js], capture_output=True, text=True, timeout=timeout)
    out = (r.stdout or "").strip()
    if r.returncode != 0:
        raise RuntimeError("eval упал: " + (r.stderr or out)[:300])
    return out


def ev_json(js):
    out = ev("JSON.stringify(" + js + ")").strip()
    # agent-browser печатает строковый результат как JSON-строку в кавычках:
    # "{\"a\":1}" — сначала снимаем внешнюю кодировку
    if out.startswith('"'):
        out = json.loads(out)
    try:
        return json.loads(out)
    except ValueError:
        m = re.search(r"\{.*\}", out, re.S)
        if not m:
            raise RuntimeError("нет JSON в ответе: " + out[:300])
        return json.loads(m.group(0))


def state():
    return ev_json("__TD.state")


def apply_step(step, log):
    for b in step.get("build", []):
        t, c, r = b[0], int(b[1]), int(b[2])
        res = ev_json("__TD.build(%d,%d,'%s')" % (c, r, t))
        log.append("  build %s(%d,%d) -> %s" % (t, c, r, res))
    for u in step.get("up", []):
        res = ev_json("__TD.up(%d,%d)" % (int(u[0]), int(u[1])))
        log.append("  up    (%d,%d) -> %s" % (int(u[0]), int(u[1]), res))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--waves", type=int, default=8, help="сколько волн играть подряд")
    ap.add_argument("--speed", type=int, default=3, help="игровая скорость x1..x3")
    ap.add_argument("--plan", default="", help="JSON-файл с планом застройки")
    ap.add_argument("--wave-timeout", type=int, default=240, help="сек реального времени на волну")
    args = ap.parse_args()

    steps = {}
    if args.plan:
        with open(args.plan, encoding="utf-8") as f:
            for st in json.load(f):
                steps[int(st["after"])] = st

    # чистый старт: без сейва, без старых настроек
    ev("localStorage.removeItem('td_save'); localStorage.removeItem('td_hp_numbers'); location.reload();")
    time.sleep(3)
    ev("__TD.setSpeed(%d)" % args.speed)
    s = state()
    print("старт: золото %s, жизни %s, скорость x%s" % (s["gold"], s["lives"], s["speed"]))

    log = []
    if 0 in steps:
        apply_step(steps[0], log)
    for line in log:
        print(line)

    rows = []
    for w in range(1, args.waves + 1):
        s0 = state()
        if s0["gameOver"] or s0["lives"] <= 0:
            print("игра кончена до волны %d" % w)
            break
        lives0, gold0, kills0 = s0["lives"], s0["gold"], s0["kills"]
        ev("document.getElementById('start-wave-btn').click()")
        t0 = time.time()
        deadline = t0 + args.wave_timeout
        while time.time() < deadline:
            time.sleep(2)
            s = state()
            if s["gameOver"] or s["victory"]:
                break
            if not s["waveActive"] and s["queue"] == 0:
                break
        else:
            print("волна %d: ТАЙМАУТ %dс — прерываю забег" % (w, args.wave_timeout))
            break
        s1 = state()
        dt = time.time() - t0
        rows.append({
            "wave": w, "dt": round(dt),
            "lives_lost": lives0 - s1["lives"], "lives_left": s1["lives"],
            "gold_start": gold0, "gold_end": s1["gold"], "gold_net": s1["gold"] - gold0,
            "killed": s1["kills"] - kills0, "alive_left": s1["alive"],
            "game_over": s1["gameOver"], "victory": s1["victory"],
        })
        r = rows[-1]
        print("волна %2d | жизни -%d (осталось %2d) | убито %3d | золото %+4d (старт %4d) | %3dс%s"
              % (w, r["lives_lost"], r["lives_left"], r["killed"], r["gold_net"], r["gold_start"], r["dt"],
                 " | ПОРАЖЕНИЕ" if r["game_over"] else ""))
        if r["game_over"]:
            print("поражение на волне %d — дальше нет смысла" % w)
            break
        if w in steps:
            log = []
            apply_step(steps[w], log)
            for line in log:
                print(line)

    print("\nитог:", json.dumps(rows, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
