// upgrade_audio.js — процедурный аудио-движок v2 вместо простых тонов:
// компрессор на мастере, общий буфер шума, фильтры с огибающими, слоистые рецепты звуков.
// Все имена функций и сигнатуры сохранены — вызовы в коде менять не нужно.
// Идемпотентен. Запуск: node scripts/upgrade_audio.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'game.js');
let lines = fs.readFileSync(FILE, 'utf8').split('\n');

if (lines.some(l => l.includes('AUDIO ENGINE v2'))) { console.log('Уже применено, выходим.'); process.exit(0); }

const startIdx = lines.findIndex(l => l.includes('// ---------- AUDIO ENGINE ----------'));
const endIdx = lines.findIndex(l => l.startsWith('        function playPoisonHit()'));
if (startIdx < 0 || endIdx < 0) { console.error('ОШИБКА: маркеры аудио-блока не найдены'); process.exit(1); }

const NEW = `        // ---------- AUDIO ENGINE v2 (процедурный синтез: слои, фильтры, компрессор) ----------
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        let audioCtx = null;
        let soundEnabled = true;
        let masterGain = null;
        let volume = 0.8;
        let noiseBuf = null; // общий буфер белого шума
        function initAudio() {
            if (!audioCtx) {
                try {
                    audioCtx = new AudioCtx();
                    masterGain = audioCtx.createGain();
                    masterGain.gain.value = volume * volume;
                    // компрессор склеивает слои и убирает перегруз на массовых звуках
                    const comp = audioCtx.createDynamicsCompressor();
                    comp.threshold.value = -18; comp.knee.value = 25;
                    comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
                    masterGain.connect(comp); comp.connect(audioCtx.destination);
                    // общий 1-секундный буфер шума (не создаём на каждый звук)
                    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
                    const d = noiseBuf.getChannelData(0);
                    for (let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1;
                } catch(e) { console.warn('Audio not supported'); }
            }
            // Браузер требует "разбудить" контекст жестом пользователя
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }
        function audioInitOnce() { initAudio(); document.removeEventListener('pointerdown', audioInitOnce); document.removeEventListener('keydown', audioInitOnce); }
        document.addEventListener('pointerdown', audioInitOnce);
        document.addEventListener('keydown', audioInitOnce);
        // Троттлинг: при 30+ врагах звуки выстрелов сливаются в треск
        let lastShootSound = 0;
        const SHOOT_SOUND_MIN_GAP = 0.035;
        // Тон: для грубых волн срезаем верх низкочастотным фильтром, чтобы не звенело
        function playTone(freq, dur, type='sine', vol=0.08, attack=0.005, freqEnd=null) {
            if (!audioCtx || !soundEnabled) return;
            try {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, now);
                if (freqEnd !== null && freqEnd > 0) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.linearRampToValueAtTime(vol, now + attack);
                gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
                let node = osc;
                if (type === 'sawtooth' || type === 'square') {
                    const lp = audioCtx.createBiquadFilter();
                    lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.6;
                    osc.connect(lp); node = lp;
                }
                node.connect(gain); gain.connect(masterGain || audioCtx.destination);
                osc.start(now); osc.stop(now + dur + 0.02);
            } catch(e) {}
        }
        function playChord(freqs, dur, type='sine', vol=0.06, stagger=0) {
            if (!audioCtx || !soundEnabled) return;
            freqs.forEach((f, i) => playTone(f, dur, type, vol, 0.01 + i * stagger));
        }
        // Шум с движущимся фильтром: whoosh/boom/crackle задаётся диапазоном частот
        function playNoise(dur, vol=0.08, filterFreq=800, filterEnd=null, ftype='lowpass', attack=0.005) {
            if (!audioCtx || !soundEnabled || !noiseBuf) return;
            try {
                const now = audioCtx.currentTime;
                const src = audioCtx.createBufferSource();
                src.buffer = noiseBuf; src.loop = true;
                const f = audioCtx.createBiquadFilter();
                f.type = ftype; f.frequency.setValueAtTime(filterFreq, now);
                if (filterEnd !== null) f.frequency.exponentialRampToValueAtTime(Math.max(30, filterEnd), now + dur);
                const g = audioCtx.createGain();
                g.gain.setValueAtTime(0.0001, now);
                g.gain.linearRampToValueAtTime(vol, now + attack);
                g.gain.exponentialRampToValueAtTime(0.001, now + dur);
                src.connect(f); f.connect(g); g.connect(masterGain || audioCtx.destination);
                src.start(now); src.stop(now + dur + 0.02);
            } catch(e) {}
        }
        // Серия коротких щелчков: искры, треск огня, осколки
        function playCrackle(dur, vol=0.02, filterFreq=2200) {
            if (!audioCtx || !soundEnabled) return;
            const n = Math.floor(dur / 0.03);
            for (let i=0;i<n;i++) {
                setTimeout(() => playNoise(0.02, vol * (0.5 + Math.random()*0.5), filterFreq, null, 'highpass', 0.001), i*30 + Math.random()*15);
            }
        }
        function playError() { playTone(150, 0.18, 'square', 0.055, 0.005, 110); playTone(98, 0.18, 'sine', 0.06, 0.005, 80); }
        function playClick() { playTone(900, 0.03, 'triangle', 0.03, 0.001, 1400); playNoise(0.015, 0.02, 4000, null, 'highpass', 0.001); }
        function playShoot(type) {
            switch(type) {
                case 'archer': // щелчок тетивы + свист
                    playTone(1500, 0.05, 'triangle', 0.045, 0.001, 700);
                    playNoise(0.07, 0.025, 3000, 900, 'bandpass', 0.002);
                    break;
                case 'cannon': // пороховой выстрел: удар + давление
                    playNoise(0.22, 0.14, 900, 90, 'lowpass', 0.004);
                    playTone(75, 0.22, 'sine', 0.12, 0.004, 32);
                    playNoise(0.05, 0.05, 2500, null, 'highpass', 0.001);
                    break;
                case 'ice': // стеклянный звон
                    playTone(1150, 0.12, 'sine', 0.04, 0.002, 950);
                    playTone(1720, 0.09, 'sine', 0.025, 0.002, 1400);
                    playNoise(0.09, 0.018, 5200, 2600, 'highpass', 0.003);
                    break;
                case 'magic': // нарастающее мерцание
                    playTone(420, 0.16, 'triangle', 0.035, 0.01, 760);
                    playTone(630, 0.14, 'sine', 0.03, 0.02, 1140);
                    playTone(1260, 0.1, 'sine', 0.012, 0.03, 1600);
                    break;
                case 'poison': // плевок
                    playTone(310, 0.09, 'sine', 0.05, 0.004, 150);
                    playNoise(0.08, 0.03, 900, 250, 'lowpass', 0.003);
                    break;
                case 'lightning': // электрический разряд
                    playTone(2400, 0.06, 'sawtooth', 0.035, 0.001, 320);
                    playNoise(0.08, 0.035, 3400, 700, 'highpass', 0.001);
                    break;
                default: playTone(800, 0.06, 'sine', 0.05);
            }
        }
        function playShootThrottled(type) {
            const now = performance.now() / 1000;
            if (now - lastShootSound < SHOOT_SOUND_MIN_GAP) return;
            lastShootSound = now;
            playShoot(type);
        }
        function playExplosion() { // бабах: суб-бас + падающий шум + осколки
            playNoise(0.55, 0.16, 1100, 60, 'lowpass', 0.005);
            playTone(58, 0.5, 'sine', 0.14, 0.005, 26);
            playCrackle(0.4, 0.02, 2600);
        }
        function playLightning() { // треск разряда + раскат грома
            playNoise(0.18, 0.09, 4200, 500, 'highpass', 0.001);
            playTone(1900, 0.08, 'sawtooth', 0.05, 0.001, 140);
            playNoise(0.7, 0.07, 700, 90, 'lowpass', 0.02);
            playTone(65, 0.7, 'sine', 0.08, 0.02, 38);
        }
        function playFrost() { // ледяная вьюга + стылое сияние
            playChord([880, 1175, 1560, 2090], 0.5, 'sine', 0.03, 0.045);
            playNoise(0.8, 0.05, 3600, 1300, 'bandpass', 0.06);
            playTone(220, 0.5, 'sine', 0.045, 0.02, 165);
        }
        function playFire() { // огненный гул + треск
            playNoise(0.9, 0.09, 240, 1400, 'bandpass', 0.05);
            playTone(85, 0.8, 'sawtooth', 0.05, 0.02, 42);
            playCrackle(0.8, 0.022, 2200);
        }
        function playBuild() { // камень на камень
            playTone(170, 0.09, 'sine', 0.08, 0.003, 95);
            playNoise(0.06, 0.05, 420, 180, 'lowpass', 0.002);
            playTone(510, 0.06, 'triangle', 0.03, 0.01, 640);
        }
        function playUpgrade() { // восторженная лесенка
            playChord([523, 659, 784, 1047], 0.16, 'triangle', 0.04, 0.035);
            playTone(2093, 0.18, 'sine', 0.02, 0.06, 1568);
        }
        function playSell() { // звон монет
            playTone(1245, 0.07, 'sine', 0.045, 0.001, 1100);
            setTimeout(() => playTone(1865, 0.1, 'sine', 0.04, 0.001, 1600), 70);
        }
        function playWaveStart() { // боевой рог
            playTone(196, 0.55, 'sawtooth', 0.07, 0.09, 185);
            playTone(294, 0.5, 'sawtooth', 0.045, 0.11, 277);
            playTone(98, 0.6, 'sine', 0.08, 0.05, 92);
            playNoise(0.5, 0.02, 600, 300, 'bandpass', 0.08);
        }
        function playVictory() { // фанфары
            const fan = [523, 659, 784, 1047];
            fan.forEach((f, i) => setTimeout(() => { playTone(f, 0.22, 'triangle', 0.06, 0.01); playTone(f*2, 0.18, 'sine', 0.02, 0.01); }, i*140));
            setTimeout(() => playChord([523, 659, 784, 1047], 0.7, 'triangle', 0.05, 0.02), 620);
        }
        function playDefeat() { // минорный спад
            [330, 262, 220, 165].forEach((f, i) => setTimeout(() => playTone(f, 0.5, 'sawtooth', 0.05, 0.02, f*0.94), i*260));
            playTone(82, 1.6, 'sine', 0.08, 0.04, 41);
        }
        function playLeak() { // прорыв: тревога
            playTone(392, 0.14, 'square', 0.05, 0.004, 350);
            setTimeout(() => playTone(311, 0.2, 'square', 0.05, 0.004, 260), 130);
            playNoise(0.15, 0.04, 800, 250, 'lowpass', 0.003);
        }
        function playBossSpawn() { // рёв: гроулинг-бас + рокот
            playTone(72, 1.0, 'sawtooth', 0.11, 0.04, 40);
            playTone(108, 0.8, 'square', 0.05, 0.06, 62);
            playNoise(1.0, 0.07, 380, 90, 'lowpass', 0.03);
            playCrackle(0.5, 0.015, 900);
        }
        function playFreeze() { // хруст льда
            playChord([1568, 2093, 2637], 0.18, 'sine', 0.03, 0.012);
            playNoise(0.2, 0.03, 5200, 2000, 'highpass', 0.002);
            playTone(1046, 0.12, 'sine', 0.02, 0.002, 880);
        }
        function playPoisonHit() { // шипение
            playNoise(0.14, 0.035, 1300, 300, 'lowpass', 0.002);
            playTone(230, 0.1, 'sine', 0.04, 0.004, 140);
        }`;

lines = lines.slice(0, startIdx).concat(NEW.split('\n'), lines.slice(endIdx + 1));
fs.writeFileSync(FILE, lines.join('\n'));
console.log(`Аудио-блок заменён (строки ${startIdx + 1}–${endIdx + 1}).`);
