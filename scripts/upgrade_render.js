// upgrade_render.js — повышение качества рендера:
//  1) HiDPI: физический буфер канвы = логический размер × devicePixelRatio (до 2x)
//  2) canvas.width/height в логике заменяются на константы VW/VH (иначе сломаются координаты)
//  3) спрайты рендерятся в двойном разрешении (SPRITE_Q = 2)
// Идемпотентен: повторный запуск ничего не меняет. Запуск: node scripts/upgrade_render.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'game.js');
let s = fs.readFileSync(FILE, 'utf8');

if (s.includes('SPRITE_Q')) { console.log('Уже применено, выходим.'); process.exit(0); }
const origLen = s.length;

// --- 1. Логические размеры вместо canvas.width/height в коде логики ---
const nW = (s.match(/canvas\.width/g) || []).length;
const nH = (s.match(/canvas\.height/g) || []).length;
s = s.replace(/canvas\.width/g, 'VW').replace(/canvas\.height/g, 'VH');
console.log(`заменено: canvas.width -> VW (${nW}), canvas.height -> VH (${nH})`);

// --- 2. Инициализация HiDPI-буфера после создания контекста ---
const ctxAnchor = "        const ctx = canvas.getContext('2d');";
if (!s.includes(ctxAnchor)) { console.error('ОШИБКА: не найден якорь ctx'); process.exit(1); }
s = s.replace(ctxAnchor, ctxAnchor + `
        const VW = 1792, VH = 1008;             // логический размер поля
        const DPR = Math.min(2, window.devicePixelRatio || 1); // плотность пикселей экрана
        canvas.width = VW * DPR; canvas.height = VH * DPR;     // физический буфер (чёткость)
        ctx.imageSmoothingQuality = 'high';`);

// --- 3. Каждый кадр рисуем в логических координатах через setTransform ---
s = s.replace(
    `function drawScene(now) {
            ctx.clearRect(0,0,VW,VH);`,
    `function drawScene(now) {
            ctx.setTransform(DPR,0,0,DPR,0,0); // логические координаты при HiDPI-буфере
            ctx.clearRect(0,0,VW,VH);`);

// --- 4. Спрайты в двойном разрешении ---
s = s.replace(
    `function makeSprite(size, paint) {
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            paint(c.getContext('2d'), size);
            return c;
        }`,
    `const SPRITE_Q = 2; // спрайты рендерятся в 2х разрешении и уменьшаются при отрисовке
        function makeSprite(size, paint) {
            const c = document.createElement('canvas');
            c.width = size*SPRITE_Q; c.height = size*SPRITE_Q;
            paint(c.getContext('2d'), size*SPRITE_Q);
            return c;
        }`);

// --- 5. Поправка единственного места, где размер спрайта берётся из физической ширины ---
s = s.replace(
    "if (spr) ctx.drawImage(spr, x - spr.width*0.65, y - spr.height*0.72, spr.width*1.3, spr.height*1.3);",
    "if (spr) ctx.drawImage(spr, x - spr.width*0.65/SPRITE_Q, y - spr.height*0.72/SPRITE_Q, spr.width*1.3/SPRITE_Q, spr.height*1.3/SPRITE_Q);");

if (s.length === origLen && !s.includes('SPRITE_Q')) { console.error('ОШИБКА: файл не изменён'); process.exit(1); }
fs.writeFileSync(FILE, s);
console.log('Готово. Проверь игру в браузере.');
