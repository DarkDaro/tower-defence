// split_game.js — разделение монолита index.html на html + css + js + assets.
// Правила проекта: ничего не удаляем — оригинал архивируется в Archive/.
// Идемпотентен: повторный запуск ничего не меняет.
// Запуск: node scripts/split_game.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const CSS_DIR = path.join(ROOT, 'css');
const JS_DIR = path.join(ROOT, 'js');
const ASSETS_DIR = path.join(ROOT, 'assets');
const ARCHIVE_DIR = path.join(ROOT, 'Archive');

function die(msg) { console.error('ОШИБКА:', msg); process.exit(1); }
function log(msg) { console.log('•', msg); }

// --- Идемпотентность ---
if (fs.existsSync(path.join(CSS_DIR, 'style.css')) || fs.existsSync(path.join(JS_DIR, 'game.js'))) {
  console.log('Уже разделено (css/js существуют), выходим.'); process.exit(0);
}

// --- Проверки перед работой ---
if (!fs.existsSync(SRC)) die('index.html не найден');
const html = fs.readFileSync(SRC, 'utf8');
const styleOpen = html.match(/<style[^>]*>/);
const styleClose = html.lastIndexOf('</style>');
const scriptOpen = html.match(/<script[^>]*>/);
const scriptClose = html.lastIndexOf('</script>');
if (!styleOpen || styleClose < 0) die('блок <style> не найден или их несколько');
if (!scriptOpen || scriptClose < 0) die('блок <script> не найден или их несколько');
const nStyleOpen = (html.match(/<style/g) || []).length;
const nScriptOpen = (html.match(/<script/g) || []).length;
if (nStyleOpen !== 1) die(`блоков <style>: ${nStyleOpen}, ожидался 1`);
if (nScriptOpen !== 1) die(`блоков <script>: ${nScriptOpen}, ожидался 1`);

// --- 1. Архивация оригинала (ничего не удаляем) ---
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const archivePath = path.join(ARCHIVE_DIR, `index_monolith_${date}.html`);
if (fs.existsSync(archivePath)) die(`архив уже существует: ${archivePath}`);
fs.copyFileSync(SRC, archivePath);
log(`оригинал заархивирован: Archive/index_monolith_${date}.html (${Buffer.byteLength(html)} байт)`);

// --- 2. Извлечение CSS и JS ---
const css = html.slice(styleOpen.index + styleOpen[0].length, styleClose).replace(/^\n+|\s+$/g, '') + '\n';
const js = html.slice(scriptOpen.index + scriptOpen[0].length, scriptClose).replace(/^\n+|\s+$/g, '') + '\n';
log(`CSS: ${css.split('\n').length} строк, ${Buffer.byteLength(css)} байт`);
log(`JS:  ${js.split('\n').length} строк, ${Buffer.byteLength(js)} байт`);

// --- 3. Новый index.html ---
let out = html;
out = out.slice(0, styleOpen.index)
  + '<link rel="stylesheet" href="css/style.css">'
  + out.slice(styleClose + '</style>'.length, scriptOpen.index)
  + '<script src="js/game.js"></script>'
  + out.slice(scriptClose + '</script>'.length);

// --- 4. Запись результатов ---
fs.mkdirSync(CSS_DIR, { recursive: true });
fs.mkdirSync(JS_DIR, { recursive: true });
fs.mkdirSync(path.join(ASSETS_DIR, 'sprites'), { recursive: true });
fs.mkdirSync(path.join(ASSETS_DIR, 'sounds'), { recursive: true });
fs.writeFileSync(path.join(CSS_DIR, 'style.css'), css);
fs.writeFileSync(path.join(JS_DIR, 'game.js'), js);
fs.writeFileSync(SRC, out);
fs.writeFileSync(path.join(ASSETS_DIR, 'sprites', '.gitkeep'), '');
fs.writeFileSync(path.join(ASSETS_DIR, 'sounds', '.gitkeep'), '');

log(`новый index.html: ${out.split('\n').length} строк, ${Buffer.byteLength(out)} байт`);
console.log('Готово. Проверка: открой index.html в браузере.');
