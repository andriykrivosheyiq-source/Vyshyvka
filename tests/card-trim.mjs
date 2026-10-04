/* Межі виробу на мокапі — щоб картка ставила виріб по центру плитки.

   ЩО БУЛО НЕ ТАК (04.10). На картці «Варіанти на вибір» спина світшота
   стояла впритул до лівого краю плитки, а справа лишалась порожнина. Картка
   центрує ВИРІБ, а не кадр, і межі виробу шукала так: фон — один колір
   (середнє по кутах), усе інше — виріб. Мокап зі світлом збоку (фон
   світліший з одного боку) давав біля темнішого краю смугу «не фону», межі
   тягнулись до рамки, і центр виробу зʼїжджав.

   ЯК МАЄ БУТИ. Фон у кожній точці — плавний перехід між кольорами чотирьох
   кутів; виріб — найбільша пляма, а дрібне й притулене до краю не рахується.

   Перевіряємо на намальованих кадрах, де справжні межі відомі:
     — рівний фон;
     — фон із градієнтом світла зліва направо й згори вниз;
     — пил і смуга біля краю кадру;
     — БІЛИЙ виріб на світло-сірому папері (відрізняється на ~12 одиниць);
     — прозорий PNG;
     — окрема деталь (шнурок) усередині — лишається частиною виробу.

   Запуск:  node tests/card-trim.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const src = fs.readFileSync(path.join(ROOT, 'loomiq-cards.js'), 'utf8');
const a = src.indexOf('  function trimOf(img){');
const b = src.indexOf('\n  }\n', a) + 4;
const fn = src.slice(a, b);

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage();
const res = await p.evaluate(async fn => {
  eval(fn.replace('function trimOf', 'window.trimOf = function'));
  const W = 900, H = 1000;
  /* Виріб: корпус + рукави, справжні межі x 250..650, y 200..820. */
  const garment = (g, fill) => {
    g.fillStyle = fill;
    g.fillRect(330, 200, 240, 620);                 // корпус
    g.fillRect(250, 260, 80, 420);                  // лівий рукав
    g.fillRect(570, 260, 80, 420);                  // правий рукав
  };
  const make = async (draw) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); draw(g);
    const im = new Image(); im.src = c.toDataURL(); await im.decode(); return im;
  };
  const box = im => { const t = trimOf(im); return { x0: Math.round(t.x), y0: Math.round(t.y),
    x1: Math.round(t.x + t.w), y1: Math.round(t.y + t.h), cx: Math.round(t.x + t.w / 2) }; };
  const out = {};
  out.рівний = box(await make(g => { g.fillStyle = '#EEEEEE'; g.fillRect(0, 0, W, H); garment(g, '#2A2A2A'); }));
  out.градієнт = box(await make(g => {
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, '#FAFAFA'); gr.addColorStop(1, '#D9D9D9');      // світло зліва
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const gv = g.createLinearGradient(0, 0, 0, H);
    gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,0.06)');
    g.fillStyle = gv; g.fillRect(0, 0, W, H);
    garment(g, '#FFFFFF'); g.fillStyle = '#1E6B3A'; g.fillRect(400, 350, 100, 120);  // білий виріб із вишивкою
  }));
  out.пил = box(await make(g => {
    g.fillStyle = '#F2F0EC'; g.fillRect(0, 0, W, H); garment(g, '#333');
    g.fillStyle = '#999'; g.fillRect(860, 40, 6, 6);                    // пилинка в кутку
    g.fillStyle = '#E2E0DC'; g.fillRect(880, 0, 20, H);                 // смуга світла біля рамки
  }));
  out.біле = box(await make(g => { g.fillStyle = '#EBEBEB'; g.fillRect(0, 0, W, H); garment(g, '#F8F8F8'); }));
  out.прозорий = box(await make(g => { garment(g, '#202020'); }));
  out.шнурок = box(await make(g => {
    g.fillStyle = '#EEE'; g.fillRect(0, 0, W, H); garment(g, '#2A2A2A');
    g.fillStyle = '#2A2A2A'; g.fillRect(440, 840, 20, 60);              // окремий шнурок під виробом
  }));
  return out;
}, fn);

// Межі шукаються на копії ~160 px: одна клітинка тут — 6 px, плюс клітинка запасу.
const near = (v, want, tol) => Math.abs(v - want) <= (tol || 16);
const real = { x0: 250, y0: 200, x1: 650, y1: 820, cx: 450 };
for(const [name, r] of Object.entries(res)){
  const want = name === 'шнурок' ? Object.assign({}, real, { y1: 900 }) : real;
  console.log('   ' + name + ': ' + JSON.stringify(r));
  ok(near(r.x0, want.x0) && near(r.x1, want.x1) && near(r.y0, want.y0) && near(r.y1, want.y1) && near(r.cx, want.cx, 8),
    name + ': межі виробу знайдено точно, центр на місці',
    name + ': межі не ті — виріб на картці зʼїде (центр ' + r.cx + ' замість ' + want.cx + ')');
}
console.log('');
console.log(bad ? 'розходжень: ' + bad : 'виріб на картці стоїть по центру плитки, хоч би яким був фон мокапа');
await browser.close();
process.exit(bad ? 1 : 0);
