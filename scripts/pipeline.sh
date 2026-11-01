#!/usr/bin/env bash
# Пайплайн перед коммитом (§16.3). Зелёный вывод = можно коммитить и пушить.
# Сборки в проекте нет (статика), поэтому проверяем то, что ломает игру в браузере:
# синтаксис JS, битые ссылки в index.html, разбаланс скобок CSS, грязные следы правок.
set -u
cd "$(dirname "$0")/.."
fail=0

echo "[1/4] node --check js/*.js"
for f in js/*.js; do
  if node --check "$f" >/dev/null 2>&1; then
    echo "  ok: $f"
  else
    echo "  FAIL: $f"; node --check "$f"; fail=1
  fi
done

echo "[1b/4] python3 -m py_compile scripts/*.py"
if python3 -m py_compile scripts/*.py; then
  echo "  ok"
else
  echo "  FAIL: python-скрипты"; fail=1
fi

echo "[2/4] ссылки index.html -> файлы на диске"
node -e 'const fs=require("fs");const html=fs.readFileSync("index.html","utf8");const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(u=>!/^(https?:|data:|mailto:|#)/.test(u));const miss=refs.filter(u=>!fs.existsSync(decodeURIComponent(u.split("?")[0].split("#")[0])));if(miss.length){console.error("  нет файла: "+miss.join(", "));process.exit(1);}' \
  && echo "  ok" || fail=1

echo "[3/4] баланс скобок CSS"
python3 - <<'PY'
ok = True
for p in ("css/style.css", "css/fonts.css"):
    s = open(p, encoding="utf-8").read()
    if s.count("{") != s.count("}"):
        print(f"  FAIL {p}: {{={s.count('{')} }}={s.count('}')}")
        ok = False
print("  ok" if ok else "  FAIL")
raise SystemExit(0 if ok else 1)
PY
[ $? -eq 0 ] || fail=1

echo "[4/4] грязные следы (TODO/FIXME/XXX/конфликты)"
if grep -RInE 'TODO|FIXME|\bXXX\b|<<<<<<<|>>>>>>>' js css index.html; then
  echo "  FAIL: найдены следы"; fail=1
else
  echo "  ok"
fi

if [ "$fail" -ne 0 ]; then
  echo "ПАЙПЛАЙН КРАСНЫЙ — коммитить нельзя"
  exit 1
fi
echo "ПАЙПЛАЙН ЗЕЛЁНЫЙ — можно коммитить"
