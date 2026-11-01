#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Снимок «кадр+позиции одним eval» — кроп буфера канвы вокруг живых врагов, зум NEAREST x2.

Урок сессии 5: скриншот страницы + пересчёт координат ненадёжен (оверлеи, пауза, DPR) —
надёжнее кропать сам буфер канвы; замер позиций и кадр обязаны быть в одном eval,
иначе пачка уходит из кропа между вызовами.

Подготовка: сервер + agent-browser open (как у wave_run.py).
Запуск: python3 scripts/snap_enemies.py --out docs/snap.png
"""
import argparse
import base64
import io
import json
import re
import subprocess
import sys

from PIL import Image

JS = """
JSON.stringify((() => {
  const st = __TD.state;
  const c = document.getElementById('game-canvas');
  const k = c.width / 1792;
  const pts = st.pos.filter(p => p[2] === 1);
  const cx = pts.length ? pts.reduce((a,p)=>a+p[0],0)/pts.length : 896;
  const cy = pts.length ? pts.reduce((a,p)=>a+p[1],0)/pts.length : 504;
  const w = Math.round(320*k), h = Math.round(220*k);
  const t = document.createElement('canvas');
  t.width = w; t.height = h;
  t.getContext('2d').drawImage(c, Math.round(cx*k - w/2), Math.round(cy*k - h/2), w, h, 0, 0, w, h);
  return { pos: st.pos, cx: Math.round(cx), cy: Math.round(cy), img: t.toDataURL('image/png') };
})())
"""

ap = argparse.ArgumentParser()
ap.add_argument("--out", default="docs/snap.png")
a = ap.parse_args()

r = subprocess.run(["agent-browser", "eval", JS], capture_output=True, text=True, timeout=60)
out = (r.stdout or "").strip()
if out.startswith('"'):  # agent-browser печатает строку как JSON-литерал — снимаем кодировку
    out = json.loads(out)
m = re.search(r"\{.*\}", out, re.S)
if not m:
    sys.exit("нет JSON: " + out[:300])
d = json.loads(m.group(0))

img = Image.open(io.BytesIO(base64.b64decode(d["img"].split(",", 1)[1])))
img = img.resize((img.width * 2, img.height * 2), Image.NEAREST)
img.save(a.out)
print("живые из первых 5:", d["pos"], "| центр кропа:", d["cx"], d["cy"], "| файл:", a.out)
