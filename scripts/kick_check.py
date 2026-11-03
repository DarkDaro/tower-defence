#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка отдачи башен по кадрам, снятым flash_check.py:
межкадровый диф пикселей в квадрате ±40px вокруг каждой башни.
Момент выстрела (вспышка ствола + отдача) = пик изменённых пикселей.
Запуск: python3 scripts/kick_check.py  (после flash_check.py)
"""
import os
import re

from PIL import Image, ImageChops

TOWERS = [  # клетки башен из flash_check.py (archer 5,8; archer 9,8; cannon 8,11)
    (5, 8, "archer-1"), (9, 8, "archer-2"), (8, 11, "cannon"),
]
RECT = (21.5, 12, 1237, 696)  # rect канвы из flash_check (1280x720)
VW, VH = 1792, 1008
SX = RECT[2] / VW
SY = RECT[3] / VH


def main():
    frames = sorted(f for f in os.listdir("/tmp/render") if re.match(r"flash_\d+\.png", f))
    assert len(frames) > 2, "нет кадров — сначала flash_check.py"
    print(f"кадров: {len(frames)}")
    for c, r, label in TOWERS:
        cx = RECT[0] + (c + 0.5) * 56 * SX
        cy = RECT[1] + (r + 0.5) * 56 * SY
        diffs = []
        for i in range(1, len(frames)):
            a = Image.open(f"/tmp/render/{frames[i-1]}").convert("RGB").crop((int(cx-40), int(cy-40), int(cx+40), int(cy+40)))
            b = Image.open(f"/tmp/render/{frames[i]}").convert("RGB").crop((int(cx-40), int(cy-40), int(cx+40), int(cy+40)))
            d = ImageChops.difference(a, b).convert("L")
            diffs.append(sum(1 for v in d.getdata() if v > 30))
        peak = max(diffs)
        med = sorted(diffs)[len(diffs) // 2]
        print(f"{label}: диф по парам кадров {diffs}")
        print(f"  медиана={med}, пик={peak} -> {'ВЫСТРЕЛ ВИДЕН (вспышка+отдача)' if peak >= max(150, med*3) else 'слабо'}")


if __name__ == "__main__":
    main()
