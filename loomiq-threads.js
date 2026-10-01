/* ══════════════════════════════════════════════════════════════════════
   ПІДБІР НИТОК ДО ЗОБРАЖЕННЯ — для графічних дизайнерів.

   Принесено з іншого проєкту двома файлами (thread-quantize.js і
   vectorize-pinned.js) разом з README; тут вони склеєні без змін в
   алгоритмі — прибрано лише import/export, бо сайт працює без збирання.
   Бібліотека трасування лежить поруч, у imagetracer.js (public domain), і
   має бути підключена ДО цього файлу.

   Три правила з README, на яких тримається результат:
     1. трасувальнику ЗАВЖДИ передаємо палітру: vectorizeBlob(blob, palette);
     2. після трасування нічого не перегруповуємо й не скорочуємо кольори;
     3. відстань — пряма в Lab (ΔE76), не CIEDE2000.
   Якість не міряти середньою похибкою по пікселях — рахувати острівці
   одного кольору й колір по областях (див. README).
   ══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
/**
 * Підбір ниток до зображення — усе в одному файлі, без залежностей.
 *
 * Що воно робить: бере растр (фото або логотип) і зводить КОЖЕН піксель до
 * одного з кольорів палітри ниток. На виході — те саме зображення, у якому
 * немає жодного кольору, окрім ниткових, плюс список ниток, що пішли в діло.
 *
 * Порядок дій усередині (саме в такому порядку, кожен крок тут не випадково):
 *   1. фон заливається від краю кадру, а не «все світле» — інакше вирізає
 *      білі деталі всередині малюнка (відблиск в оці, біла пляма на грудях);
 *   2. фото визначається автоматично і йому прибирається зерно; плоску
 *      графіку (логотип, макет) не чіпає, бо це з'їдає тонкі лінії й написи;
 *   3. нитки обираються жадібно — щоразу та, що прибирає найбільше похибки;
 *   4. групи переобирають нитку кілька разів (крок обміну, як у k-means,
 *      але обрати можна лише реальну нитку);
 *   5. плями, менші за те, що можна вишити, вливаються в найбільшого сусіда.
 *
 * Міряти відстань між кольорами — пряма відстань у Lab (ΔE76). CIEDE2000 тут
 * ГІРШЕ: вона пробачає втрату насиченості, і золотава шерсть стає оливковою.
 *
 * Використання у браузері:
 *     import { quantizeToThreads } from './thread-quantize.js'
 *     const { blob, palette } = await quantizeToThreads(file, 18)
 *     // blob    — PNG, у якому тільки кольори ниток
 *     // palette — [{r,g,b,a}] ті кольори; віддайте їх трасувальнику (див. нижче)
 *
 * Поза браузером (Node, воркер, тест) — беріть quantizePixels(px, W, H, K)
 * і дайте їй сирий RGBA-масив; вона змінює його на місці.
 *
 * Палітру нижче заміните на свою: {code, rgb:[r,g,b], hex}. Більше нічого
 * міняти не треба — усе рахується з rgb.
 */

const THREAD_PALETTE = [
  {code:'1103',rgb:[224,222,182],hex:'#E0DEB6'},{code:'1129',rgb:[189,94,119],hex:'#BD5E77'},
  {code:'1160',rgb:[0,47,54],hex:'#002F36'},{code:'1182',rgb:[116,133,53],hex:'#748535'},
  {code:'2223',rgb:[151,124,154],hex:'#977C9A'},{code:'1104',rgb:[212,202,110],hex:'#D4CA6E'},
  {code:'1130',rgb:[108,44,60],hex:'#6C2C3C'},{code:'1161',rgb:[168,143,131],hex:'#A88F83'},
  {code:'1184',rgb:[123,161,81],hex:'#7BA151'},{code:'2228',rgb:[45,29,66],hex:'#2D1D42'},
  {code:'1107',rgb:[211,174,7],hex:'#D3AE07'},{code:'1131',rgb:[169,59,89],hex:'#A93B59'},
  {code:'1163',rgb:[127,104,96],hex:'#7F6860'},{code:'1186',rgb:[74,117,43],hex:'#4A752B'},
  {code:'2230',rgb:[152,155,174],hex:'#989BAE'},{code:'2266',rgb:[117,65,98],hex:'#754162'},
  {code:'1108',rgb:[213,190,0],hex:'#D5BE00'},{code:'1133',rgb:[138,19,56],hex:'#8A1338'},
  {code:'1165',rgb:[136,99,91],hex:'#88635B'},{code:'1189',rgb:[0,90,60],hex:'#005A3C'},
  {code:'2233',rgb:[156,152,164],hex:'#9C98A4'},{code:'2267',rgb:[121,33,87],hex:'#792157'},
  {code:'1112',rgb:[180,135,14],hex:'#B4870E'},{code:'1134',rgb:[138,19,56],hex:'#8A1338'},
  {code:'1168',rgb:[128,80,67],hex:'#805043'},{code:'1191',rgb:[15,83,2],hex:'#0F5302'},
  {code:'2236',rgb:[95,87,133],hex:'#5F5785'},{code:'2269',rgb:[87,8,63],hex:'#57083F'},
  {code:'4473',rgb:[173,100,51],hex:'#AD6433'},{code:'4494',rgb:[115,88,60],hex:'#73583C'},
  {code:'3359',rgb:[15,24,55],hex:'#0F1837'},{code:'4474',rgb:[213,189,186],hex:'#D5BDBA'},
  {code:'4495',rgb:[43,31,29],hex:'#2B1F1D'},{code:'4442',rgb:[120,177,197],hex:'#78B1C5'},
  {code:'4477',rgb:[156,85,80],hex:'#9C5550'},{code:'4497',rgb:[74,99,134],hex:'#4A6386'},
  {code:'3367',rgb:[94,109,121],hex:'#5E6D79'},{code:'4478',rgb:[135,52,48],hex:'#873430'},
  {code:'4499',rgb:[16,36,83],hex:'#102453'},{code:'3370',rgb:[63,79,87],hex:'#3F4F57'},
  {code:'4410',rgb:[88,43,32],hex:'#582B20'},{code:'4479',rgb:[153,52,64],hex:'#993440'},
  {code:'5500',rgb:[6,11,25],hex:'#060B19'},{code:'2262',rgb:[210,153,170],hex:'#D299AA'},
  {code:'3301',rgb:[180,176,168],hex:'#B4B0A8'},{code:'3336',rgb:[230,230,225],hex:'#E6E6E1'},
  {code:'3357',rgb:[17,29,51],hex:'#111D33'},{code:'3394',rgb:[66,52,42],hex:'#42342A'},
  {code:'4440',rgb:[22,34,41],hex:'#162229'},{code:'2264',rgb:[174,105,133],hex:'#AE6985'},
  {code:'3303',rgb:[181,170,146],hex:'#B5AA92'},{code:'3338',rgb:[15,21,28],hex:'#0F151C'},
  {code:'3309',rgb:[70,67,57],hex:'#464339'},{code:'3340',rgb:[181,170,146],hex:'#B5AA92'},
  {code:'3361',rgb:[155,159,155],hex:'#9B9F9B'},{code:'3311',rgb:[64,68,63],hex:'#40443F'},
  {code:'3341',rgb:[170,185,186],hex:'#AAB9BA'},{code:'3314',rgb:[76,66,80],hex:'#4C4250'},
  {code:'3343',rgb:[130,152,175],hex:'#8298AF'},{code:'4448',rgb:[18,58,114],hex:'#123A72'},
  {code:'3324',rgb:[98,163,186],hex:'#62A3BA'},{code:'3350',rgb:[34,70,133],hex:'#224685'},
  {code:'3384',rgb:[226,217,180],hex:'#E2D9B4'},{code:'4430',rgb:[85,95,87],hex:'#555F57'},
  {code:'4455',rgb:[72,70,71],hex:'#484647'},{code:'4486',rgb:[43,69,49],hex:'#2B4531'},
  {code:'3329',rgb:[54,118,156],hex:'#36769C'},{code:'3351',rgb:[22,57,121],hex:'#163979'},
  {code:'3385',rgb:[208,182,132],hex:'#D0B684'},{code:'4431',rgb:[128,165,164],hex:'#80A5A4'},
  {code:'4456',rgb:[72,70,71],hex:'#484647'},{code:'4487',rgb:[57,60,56],hex:'#393C38'},
  {code:'3333',rgb:[109,167,159],hex:'#6DA79F'},{code:'3353',rgb:[13,43,96],hex:'#0D2B60'},
  {code:'3387',rgb:[156,138,101],hex:'#9C8A65'},{code:'4433',rgb:[51,85,90],hex:'#33555A'},
  {code:'4457',rgb:[50,49,46],hex:'#32312E'},{code:'4489',rgb:[154,150,142],hex:'#9A968E'},
  {code:'3334',rgb:[93,161,161],hex:'#5DA1A1'},{code:'3354',rgb:[8,39,108],hex:'#08276C'},
  {code:'3391',rgb:[107,76,46],hex:'#6B4C2E'},{code:'4436',rgb:[16,57,79],hex:'#10394F'},
  {code:'4458',rgb:[21,20,23],hex:'#151417'},{code:'4492',rgb:[156,138,101],hex:'#9C8A65'},
  {code:'3335',rgb:[71,135,130],hex:'#478782'},{code:'3356',rgb:[6,31,94],hex:'#061F5E'},
  {code:'3392',rgb:[79,53,35],hex:'#4F3523'},{code:'4438',rgb:[13,44,48],hex:'#0D2C30'},
  {code:'4471',rgb:[207,205,182],hex:'#CFCDB6'},{code:'4493',rgb:[134,113,76],hex:'#86714C'},
  {code:'1114',rgb:[214,155,55],hex:'#D69B37'},{code:'1115',rgb:[176,130,65],hex:'#B08241'},
  {code:'1116',rgb:[181,118,51],hex:'#B57633'},{code:'1117',rgb:[177,106,42],hex:'#B16A2A'},
  {code:'1118',rgb:[171,89,44],hex:'#AB592C'},{code:'1120',rgb:[181,94,59],hex:'#B55E3B'},
  {code:'1121',rgb:[247,245,242],hex:'#F7F5F2'},{code:'1122',rgb:[221,102,204],hex:'#DD66CC'},
  {code:'1125',rgb:[208,163,162],hex:'#D0A3A2'},{code:'1135',rgb:[165,51,47],hex:'#A5332F'},
  {code:'1142',rgb:[173,194,135],hex:'#ADC287'},{code:'1145',rgb:[108,148,107],hex:'#6C946B'},
  {code:'1148',rgb:[113,130,97],hex:'#718261'},{code:'1150',rgb:[56,79,44],hex:'#384F2C'},
  {code:'1152',rgb:[22,89,79],hex:'#16594F'},{code:'1154',rgb:[30,77,76],hex:'#1E4D4C'},
  {code:'1155',rgb:[32,86,69],hex:'#205645'},{code:'1157',rgb:[29,48,45],hex:'#1D302D'},
  {code:'1166',rgb:[128,80,67],hex:'#805043'},{code:'1170',rgb:[99,60,65],hex:'#633C41'},
  {code:'1172',rgb:[181,184,115],hex:'#B5B873'},{code:'1173',rgb:[118,121,73],hex:'#767949'},
  {code:'1174',rgb:[75,76,30],hex:'#4B4C1E'},{code:'1175',rgb:[74,84,54],hex:'#4A5436'},
  {code:'1176',rgb:[49,56,34],hex:'#313822'},{code:'1179',rgb:[39,47,29],hex:'#272F1D'},
  {code:'1181',rgb:[209,206,78],hex:'#D1CE4E'},{code:'1194',rgb:[49,100,60],hex:'#31643C'},
  {code:'1196',rgb:[38,79,48],hex:'#264F30'},{code:'2201',rgb:[180,170,140],hex:'#B4AA8C'},
  {code:'2206',rgb:[128,110,76],hex:'#806E4C'},{code:'2208',rgb:[114,94,59],hex:'#725E3B'},
  {code:'2210',rgb:[92,68,40],hex:'#5C4428'},{code:'2219',rgb:[26,22,21],hex:'#1A1615'},
  {code:'2237',rgb:[93,91,156],hex:'#5D5B9C'},{code:'2238',rgb:[122,107,159],hex:'#7A6B9F'},
  {code:'2247',rgb:[207,149,121],hex:'#CF9579'},{code:'2249',rgb:[193,139,121],hex:'#C18B79'},
  {code:'2251',rgb:[191,102,57],hex:'#BF6639'},{code:'2253',rgb:[201,194,178],hex:'#C9C2B2'},
  {code:'2255',rgb:[128,112,89],hex:'#807059'},{code:'2260',rgb:[71,44,37],hex:'#472C25'},
  {code:'2261',rgb:[183,153,169],hex:'#B799A9'},{code:'2270',rgb:[71,37,72],hex:'#472548'},
  {code:'2274',rgb:[74,26,39],hex:'#4A1A27'},{code:'2275',rgb:[78,24,33],hex:'#4E1821'},
  {code:'2280',rgb:[40,14,29],hex:'#280E1D'},{code:'2282',rgb:[188,171,93],hex:'#BCAB5D'},
  {code:'2285',rgb:[155,140,76],hex:'#9B8C4C'},{code:'2287',rgb:[135,118,67],hex:'#877643'},
  {code:'2299',rgb:[59,56,44],hex:'#3B382C'},{code:'3315',rgb:[108,104,117],hex:'#6C6875'},
  {code:'3318',rgb:[22,25,38],hex:'#161926'},{code:'3320',rgb:[32,36,44],hex:'#20242C'},
  {code:'3321',rgb:[149,184,185],hex:'#95B8B9'},{code:'3344',rgb:[128,161,199],hex:'#80A1C7'},
  {code:'3346',rgb:[70,115,168],hex:'#4673A8'},{code:'3347',rgb:[61,101,148],hex:'#3D6594'},
  {code:'3372',rgb:[74,89,101],hex:'#4A5965'},{code:'3374',rgb:[52,63,69],hex:'#343F45'},
  {code:'3380',rgb:[26,36,47],hex:'#1A242F'},{code:'3381',rgb:[225,212,128],hex:'#E1D480'},
  {code:'3397',rgb:[76,55,41],hex:'#4C3729'},{code:'4402',rgb:[176,69,67],hex:'#B04543'},
  {code:'4406',rgb:[106,52,39],hex:'#6A3427'},{code:'4414',rgb:[56,36,40],hex:'#382428'},
  {code:'4416',rgb:[87,28,35],hex:'#571C23'},{code:'4417',rgb:[38,15,22],hex:'#260F16'},
  {code:'4426',rgb:[106,116,110],hex:'#6A746E'},{code:'4441',rgb:[141,168,168],hex:'#8DA8A8'},
  {code:'4449',rgb:[49,74,103],hex:'#314A67'},{code:'4450',rgb:[23,53,78],hex:'#17354E'},
  {code:'4451',rgb:[140,123,113],hex:'#8C7B71'},{code:'4454',rgb:[97,93,86],hex:'#615D56'},
  {code:'4480',rgb:[148,42,43],hex:'#942A2B'},{code:'4481',rgb:[156,139,151],hex:'#9C8B97'},
  {code:'4482',rgb:[94,69,112],hex:'#5E4570'},{code:'4483',rgb:[119,64,89],hex:'#774059'},
  {code:'4445',rgb:[127,225,246],hex:'#7FE1F6'},{code:'3349',rgb:[122,164,210],hex:'#7AA4D2'},
  {code:'2277',rgb:[136,47,95],hex:'#882F5F'},{code:'1146',rgb:[169,241,201],hex:'#A9F1C9'},
]

// --- colour space ---
function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722)
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116)
  const fx = f(x), fy = f(y), fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
function deltaE(a, b) {
  const dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2]
  return Math.sqrt(dl * dl + da * da + db * db)
}

const PALETTE_LAB = THREAD_PALETTE.map(p => rgbToLab(p.rgb))

/** Nearest thread in the palette to a Lab colour. */
function nearestThread(lab) {
  let best = 0, bestD = Infinity
  for (let i = 0; i < PALETTE_LAB.length; i++) {
    const d = deltaE(lab, PALETTE_LAB[i])
    if (d < bestD) { bestD = d; best = i }
  }
  return THREAD_PALETTE[best]
}

/**
 * Order the thread palette the way an eye looks for a colour: neutrals first
 * (white → black), then hue families around the wheel, and inside each family
 * from light to dark. Sorting by code number puts unrelated shades together
 * and makes "find me a blue" a hunt.
 */
function paletteByColour(list = THREAD_PALETTE) {
  return paletteFamilies(list).flatMap(f => f.items)
}

/**
 * Comparator that puts similar shades next to each other: neutrals first
 * (light → dark), then a hue sweep, light → dark within each close hue.
 * Used for the thread list so related colours sit together and are easy to
 * drag onto one another.
 */
function byColour(rgbOf = x => x.rgb) {
  const key = item => {
    const rgb = rgbOf(item)
    if (!rgb) return [2, 0, 0]
    const [r, g, b] = rgb
    const R = r / 255, G = g / 255, B = b / 255
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn
    const l = (mx + mn) / 2
    // Raw chroma, not HSL saturation: the latter blows up near white, so a
    // cream like #F7F5F2 scored 0.24 and was filed as a colour, not a neutral.
    if (d < 0.10) return [0, 0, -l]
    let h
    if (mx === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6
    else if (mx === G) h = ((B - R) / d + 2) / 6
    else h = ((R - G) / d + 4) / 6
    h = (h * 360 + 345) % 360                 // start the sweep at red
    return [1, Math.round(h / 15), -l]        // 15° bands keep near hues together
  }
  return (a, b) => {
    const ka = key(a), kb = key(b)
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2]
  }
}

/**
 * Lay the palette out as one continuous field: hue sweeps left to right, and
 * each column is a light-to-dark ramp. No hard family breaks, so neighbouring
 * shades stay neighbours and the eye can slide along looking for a match.
 * `rows` is how many swatches fit in a column.
 */
function paletteRamp(list = THREAD_PALETTE, rows = 7) {
  const R = Math.max(1, rows | 0)
  const hsl = ({ rgb: [r, g, b] }) => {
    const Rr = r / 255, G = g / 255, B = b / 255
    const mx = Math.max(Rr, G, B), mn = Math.min(Rr, G, B), d = mx - mn
    const l = (mx + mn) / 2
    if (!d) return { h: 0, s: 0, l }
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    let h
    if (mx === Rr) h = ((G - B) / d + (G < B ? 6 : 0)) / 6
    else if (mx === G) h = ((B - Rr) / d + 2) / 6
    else h = ((Rr - G) / d + 4) / 6
    return { h: h * 360, s, l }
  }
  const rowsData = list.map(p => {
    const v = hsl(p)
    const [r, g, b] = p.rgb
    v.chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
    return { p, ...v }
  })
  // One continuous sequence: neutrals first (light → dark), then a hue sweep
  // starting at red. Chunking this in one pass keeps every column aligned —
  // splitting the two groups separately left a ragged column that shifted
  // everything after it and broke the ramp.
  const neutral = rowsData.filter(r => r.chroma < 0.10).sort((a, b) => b.l - a.l)
  const chroma = rowsData.filter(r => r.chroma >= 0.10).sort((a, b) => ((a.h + 345) % 360) - ((b.h + 345) % 360))
  const seq = neutral.concat(chroma)
  const out = []
  for (let i = 0; i < seq.length; i += R) {
    const col = seq.slice(i, i + R).sort((a, b) => b.l - a.l)     // light → dark
    out.push(...col.map(r => r.p))
  }
  return out
}

function paletteFamilies(list = THREAD_PALETTE) {
  const hsl = ({ rgb: [r, g, b] }) => {
    const R = r / 255, G = g / 255, B = b / 255
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn
    const l = (mx + mn) / 2
    if (!d) return { h: 0, s: 0, l }
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    let h
    if (mx === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6
    else if (mx === G) h = ((B - R) / d + 2) / 6
    else h = ((R - G) / d + 4) / 6
    return { h: h * 360, s, l }
  }
  const FAMILIES = 12
  const NAMES = ['Червоні','Помаранчеві','Жовті','Лаймові','Зелені','Смарагдові','Бірюзові','Блакитні','Сині','Фіолетові','Пурпурові','Малинові']
  const rows = list.map(p => ({ p, ...hsl(p) }))
  const out = []
  const neutral = rows.filter(r => r.s < 0.12).sort((a, b) => b.l - a.l)   // white → black
  if (neutral.length) out.push({ key: 'neutral', name: 'Нейтральні', items: neutral.map(r => r.p) })
  const buckets = new Map()
  for (const r of rows.filter(r => r.s >= 0.12)) {
    const k = Math.floor(((r.h + 15) % 360) / (360 / FAMILIES))
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(r)
  }
  for (let k = 0; k < FAMILIES; k++) {
    const b = buckets.get(k)
    if (!b) continue
    b.sort((x, y) => y.l - x.l)                                            // light → dark
    out.push({ key: 'h' + k, name: NAMES[k], items: b.map(r => r.p) })
  }
  return out
}

/**
 * Clear the backdrop the subject was photographed against.
 *
 * Judging "background" by brightness alone punched holes in the artwork: a
 * white blaze on a dog's chest, the highlight on its nose and the glint in an
 * eye are all brighter than the threshold and were simply cut away, which is
 * why parts of the picture came back with no colour at all. The backdrop is
 * the pale region that REACHES THE EDGE of the frame, so flood it from there.
 */
function clearBackdrop(px, W, H) {
  const total = W * H
  const pale = i => { const j = i * 4; return px[j + 3] < 32 || (px[j] > 226 && px[j + 1] > 226 && px[j + 2] > 226) }
  const seen = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0, tail = 0
  const push = i => { if (!seen[i] && pale(i)) { seen[i] = 1; queue[tail++] = i } }
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1) }
  while (head < tail) {
    const i = queue[head++], x = i % W, y = (i / W) | 0
    if (x > 0) push(i - 1)
    if (x < W - 1) push(i + 1)
    if (y > 0) push(i - W)
    if (y < H - 1) push(i + W)
  }
  for (let i = 0; i < total; i++) if (seen[i]) px[i * 4 + 3] = 0
  return seen
}

/**
 * Is this a photograph, or flat artwork?
 *
 * The two want opposite treatment. A photograph is grain all the way down and
 * has to be calmed before its colours mean anything; a logo or a screenshot is
 * already flat, and the same treatment eats its hairlines and small lettering.
 * Photographs have almost no pixel that matches its neighbours exactly, flat
 * artwork has little else, so counting them tells the two apart.
 */
function isPhotographic(px, W, H) {
  let flat = 0, n = 0
  const near = (a, b) => Math.abs(px[a] - px[b]) <= 2 && Math.abs(px[a+1] - px[b+1]) <= 2 &&
                         Math.abs(px[a+2] - px[b+2]) <= 2
  for (let y = 1; y < H - 1; y += 3) {
    for (let x = 1; x < W - 1; x += 3) {
      const i = (y * W + x) * 4
      if (px[i + 3] < 32) continue
      n++
      if (near(i, i - 4) && near(i, i + 4) && near(i, i - W * 4) && near(i, i + W * 4)) flat++
    }
  }
  return n > 0 && flat / n < 0.5
}

/**
 * Take the grain out without softening edges.
 *
 * A photograph's every flat-looking area is really thousands of slightly
 * different pixels. Matched one by one they flip between two threads and the
 * result is the speckle you see on screen — 28000 separate islands of colour on
 * one portrait. Averaging would blur the edges too, so instead each pixel takes
 * the colour of whichever neighbour has the MIDDLE brightness: real colours
 * only, nothing invented, and an edge keeps its side.
 */
function smooth(px, W, H, passes = 2) {
  const total = W * H
  const src = new Uint8ClampedArray(total * 4)
  const lum = new Float32Array(9)
  const idx = new Int32Array(9)
  for (let pass = 0; pass < passes; pass++) {
    src.set(px)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x
        if (src[i * 4 + 3] < 32) continue
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const k = (i + dy * W + dx) * 4
            if (src[k + 3] < 32) continue
            lum[n] = src[k] * 0.299 + src[k + 1] * 0.587 + src[k + 2] * 0.114
            idx[n] = k; n++
          }
        }
        if (n < 5) continue
        // partial selection sort up to the middle — nine items, not worth more
        const mid = n >> 1
        for (let a = 0; a <= mid; a++) {
          let m = a
          for (let b = a + 1; b < n; b++) if (lum[b] < lum[m]) m = b
          if (m !== a) { const tl = lum[a]; lum[a] = lum[m]; lum[m] = tl; const ti = idx[a]; idx[a] = idx[m]; idx[m] = ti }
        }
        const s = idx[mid], d = i * 4
        px[d] = src[s]; px[d + 1] = src[s + 1]; px[d + 2] = src[s + 2]
      }
    }
  }
}

/**
 * Absorb islands too small to embroider into the biggest region touching them.
 * Anything left over becomes its own path in the SVG, so this is what decides
 * whether the operator gets shapes to fill or confetti.
 *
 * One pass is not enough and merging into the most-bordering LABEL is not
 * enough either: a speck would join a neighbour that was itself a speck about
 * to move elsewhere, and be left stranded as a single pixel of a colour nothing
 * around it uses. So each speck joins the largest REGION it touches, and the
 * whole thing repeats until a pass changes nothing.
 *
 * Size alone would also throw away the things worth keeping. The catchlight in
 * an eye is as small as the grain around it, but it stands far apart from what
 * surrounds it, while grain barely differs from its neighbour. So a small patch
 * survives if it is a strong enough contrast to be a feature rather than noise.
 */
function despeckle(labels, W, H, minPx, centres) {
  const KEEP_CONTRAST = 28              // deltaE between a patch and its surround
  const NEVER_KEEP = Math.max(5, minPx >> 4)   // ...below this it is grain, however
                                               // sharp: at full resolution single
                                               // fur strands are sharp too
  const total = W * H
  const comp = new Int32Array(total)
  const stack = new Int32Array(total)
  for (let pass = 0; pass < 8; pass++) {
    comp.fill(-1)
    const size = [], seed = []
    for (let start = 0; start < total; start++) {
      if (comp[start] >= 0 || labels[start] === 255) continue
      const lab = labels[start], id = size.length
      let sp = 0, n = 0
      stack[sp++] = start; comp[start] = id
      while (sp) {
        const i = stack[--sp]; n++
        const x = i % W, y = (i / W) | 0
        if (x > 0 && comp[i - 1] < 0 && labels[i - 1] === lab) { comp[i - 1] = id; stack[sp++] = i - 1 }
        if (x < W - 1 && comp[i + 1] < 0 && labels[i + 1] === lab) { comp[i + 1] = id; stack[sp++] = i + 1 }
        if (y > 0 && comp[i - W] < 0 && labels[i - W] === lab) { comp[i - W] = id; stack[sp++] = i - W }
        if (y < H - 1 && comp[i + W] < 0 && labels[i + W] === lab) { comp[i + W] = id; stack[sp++] = i + W }
      }
      size.push(n); seed.push(start)
    }
    // Largest first, so a speck that joins another speck still ends up with a
    // region that has already settled.
    const order = []
    for (let id = 0; id < size.length; id++) if (size[id] < minPx) order.push(id)
    order.sort((a, b) => size[b] - size[a])
    let changed = 0
    const touch = new Map()
    for (const id of order) {
      touch.clear()
      let sp = 0, n = 0
      const local = new Int32Array(size[id])
      const walked = new Int32Array(size[id])
      stack[sp++] = seed[id]; comp[seed[id]] = -2 - id          // mark as walked
      while (sp) {
        const i = stack[--sp]
        local[n] = i; walked[n] = i; n++
        const x = i % W, y = (i / W) | 0
        const look = ni => {
          if (labels[ni] === 255) return
          if (comp[ni] === id) { comp[ni] = -2 - id; stack[sp++] = ni }
          else if (comp[ni] >= 0) touch.set(comp[ni], Math.max(touch.get(comp[ni]) || 0, size[comp[ni]]))
        }
        if (x > 0) look(i - 1)
        if (x < W - 1) look(i + 1)
        if (y > 0) look(i - W)
        if (y < H - 1) look(i + W)
      }
      let bestId = -1, bestSize = -1
      for (const [cid, sz] of touch) if (sz > bestSize) { bestSize = sz; bestId = cid }
      for (let k = 0; k < n; k++) comp[walked[k]] = id                    // restore
      if (bestId < 0) continue                              // floating alone
      const lab = labels[seed[bestId]], own = labels[seed[id]]
      if (lab === own) continue
      if (n > NEVER_KEEP && deltaE(centres[own], centres[lab]) > KEEP_CONTRAST) continue
      for (let k = 0; k < n; k++) labels[local[k]] = lab
      changed++
    }
    if (!changed) break
  }
}

/**
 * The colour reduction itself, free of any browser API so the same code can be
 * measured offline. Rewrites `px` (RGBA) in place and returns the threads used.
 *
 * @param {Uint8ClampedArray|Uint8Array} px  RGBA pixels, mutated in place
 * @param {number} W @param {number} H @param {number} maxColors
 */
function quantizePixels(px, W, H, maxColors = 12) {
  const K = Math.max(2, Math.min(32, maxColors | 0 || 12))
  const total = W * H

  clearBackdrop(px, W, H)
  const photo = isPhotographic(px, W, H)
  if (photo) smooth(px, W, H)

  // Colour census over every pixel — a stride sample missed small features
  // entirely (an eye is a few hundred pixels out of millions). The bin keeps a
  // running mean so its colour is the real one, not the corner of the bucket.
  const bins = new Map()
  for (let i = 0; i < total; i++) {
    const j = i * 4
    if (px[j + 3] < 32) continue
    const key = ((px[j] >> 3) << 10) | ((px[j + 1] >> 3) << 5) | (px[j + 2] >> 3)
    const e = bins.get(key)
    if (e) { e.n++; e.r += px[j]; e.g += px[j + 1]; e.b += px[j + 2] }
    else bins.set(key, { n: 1, r: px[j], g: px[j + 1], b: px[j + 2] })
  }
  if (!bins.size) return { threads: [] }
  const binLab = [], binN = []
  for (const e of bins.values()) {
    binLab.push(rgbToLab([e.r / e.n, e.g / e.n, e.b / e.n]))
    binN.push(e.n)
  }

  const P = PALETTE_LAB.length, Bn = binLab.length
  const dist = new Float32Array(P * Bn)
  for (let t = 0; t < P; t++) {
    const lab = PALETTE_LAB[t]
    for (let i = 0; i < Bn; i++) dist[t * Bn + i] = deltaE(binLab[i], lab)
  }

  // How much each bin counts when choosing threads. Damping this to give rare
  // colours more say was measurably worse — it bought a thread for a handful of
  // stray pixels and paid for it across the whole picture.
  const weight = new Float32Array(Bn)
  let pixels = 0
  for (let i = 0; i < Bn; i++) { weight[i] = binN[i]; pixels += weight[i] }

  // Pick the threads directly: repeatedly take whichever thread removes the
  // most remaining error. Clustering first and snapping afterwards wasted the
  // budget — several centres landed on one thread and merged silently.
  const best = new Float32Array(Bn).fill(1e9)
  let chosen = []
  for (let pick = 0; pick < K; pick++) {
    let bestT = -1, bestGain = 0
    for (let t = 0; t < P; t++) {
      if (chosen.indexOf(t) >= 0) continue
      let gain = 0
      const off = t * Bn
      for (let i = 0; i < Bn; i++) { const d = dist[off + i]; if (d < best[i]) gain += (best[i] - d) * weight[i] }
      if (gain > bestGain) { bestGain = gain; bestT = t }
    }
    if (bestT < 0) break
    // Stop once another thread barely helps. Without this the budget is spent
    // on near-identical tones: a two-colour logo came back as eighteen, which
    // shatters it into fragments and stalls the tracer.
    if (chosen.length && bestGain / pixels < 0.012) break
    chosen.push(bestT)
    const off = bestT * Bn
    for (let i = 0; i < Bn; i++) if (dist[off + i] < best[i]) best[i] = dist[off + i]
  }

  // Greedy commits to its first pick before it knows what the others will be.
  // Reassign every bin to its nearest chosen thread, then let each group elect
  // the thread that actually suits it, and repeat — the same exchange step
  // k-means uses, except a group can only elect a real thread.
  const owner = new Int32Array(Bn)
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i < Bn; i++) {
      let bi = 0, bd = Infinity
      for (let c = 0; c < chosen.length; c++) { const d = dist[chosen[c] * Bn + i]; if (d < bd) { bd = d; bi = c } }
      owner[i] = bi
    }
    const next = []
    let moved = false
    for (let c = 0; c < chosen.length; c++) {
      let bestT = chosen[c], bestCost = Infinity
      for (let t = 0; t < P; t++) {
        if (t !== chosen[c] && next.indexOf(t) >= 0) continue
        let cost = 0
        const off = t * Bn
        for (let i = 0; i < Bn; i++) if (owner[i] === c) cost += dist[off + i] * weight[i]
        if (cost < bestCost) { bestCost = cost; bestT = t }
      }
      if (bestT !== chosen[c]) moved = true
      next.push(bestT)
    }
    chosen = next
    if (!moved) break
  }

  const threads = chosen.map(t => THREAD_PALETTE[t])
  const centres = chosen.map(t => PALETTE_LAB[t])

  // 5-bit-per-channel lookup table keeps the per-pixel pass to a table read.
  const LUT = new Int16Array(32768).fill(-1)
  const labels = new Uint8Array(total).fill(255)
  for (let i = 0; i < total; i++) {
    const j = i * 4
    if (px[j + 3] < 32) continue
    const key = ((px[j] >> 3) << 10) | ((px[j + 1] >> 3) << 5) | (px[j + 2] >> 3)
    let idx = LUT[key]
    if (idx < 0) {
      const lab = rgbToLab([px[j], px[j + 1], px[j + 2]])
      let bi = 0, bd = Infinity
      for (let t = 0; t < centres.length; t++) {
        const d = deltaE(lab, centres[t])
        if (d < bd) { bd = d; bi = t }
      }
      idx = bi
      LUT[key] = idx
    }
    labels[i] = idx
  }

  // Grain in a photograph comes in patches far bigger than one pixel, so the
  // broom has to be wide. Flat artwork has no grain at all and its small parts
  // are meant to be there, so barely sweep it.
  despeckle(labels, W, H, photo ? Math.max(24, Math.round(total * 0.0002))
                                : Math.max(8, Math.round(total * 0.00002)), centres)

  const used = new Set()
  for (let i = 0; i < total; i++) {
    const l = labels[i]
    if (l === 255) continue
    used.add(l)
    const rgb = threads[l].rgb, j = i * 4
    px[j] = rgb[0]; px[j + 1] = rgb[1]; px[j + 2] = rgb[2]
  }
  return { threads: threads.filter((_, i) => used.has(i)) }
}

/** Browser wrapper: blob in, recoloured PNG blob + the threads used out. */
function quantizeToThreads(blob, maxColors = 12) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const W = img.naturalWidth, H = img.naturalHeight
        const c = document.createElement('canvas')
        c.width = W; c.height = H
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        const imageData = ctx.getImageData(0, 0, W, H)
        const { threads } = quantizePixels(imageData.data, W, H, maxColors)
        if (!threads.length) { resolve({ blob, palette: null }); return }
        ctx.putImageData(imageData, 0, 0)
        const used = threads.map(t => ({ r: t.rgb[0], g: t.rgb[1], b: t.rgb[2], a: 255 }))
        c.toBlob(b => resolve({ blob: b || blob, palette: used }), 'image/png')
      } catch (e) {
        console.warn('[Quantize] failed, using original', e)
        resolve({ blob, palette: null })
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ blob, palette: null }) }
    img.src = url
  })
}

/* ── vectorize-pinned.js ── */
/**
 * Трасування з ПРИБИТОЮ палітрою — друга половина справи.
 *
 * Якщо просто віддати трасувальнику вже зведену картинку, він наново зробить
 * свою квантизацію поверх нашої: заливки з'їдуть із ниток, і далі їх прибиває
 * вже до ІНШОЇ нитки. Саме так чорна зіниця виходила білою.
 *
 * Лікується тим, що йому передають точні кольори (`pal`) і ОДИН цикл
 * (`colorquantcycles: 1`) — більше циклів усереднюють палітру назад.
 *
 * Дві пастки, на яких я вже обпікся:
 *   • прозорий запис у палітрі має бути ЧОРНИМ {r:0,g:0,b:0,a:0}. Canvas
 *     множить на альфу, тож прозорий піксель читається як 0,0,0,0 хоч би
 *     яким він був. З білим прозорим записом увесь фон ставав чорною плитою.
 *   • шляхи з opacity="0" треба вирізати, інакше прозорий шар лишається
 *     у SVG окремою «кольоровою» групою.
 *
 * Потребує лише `imagetracerjs` (npm i imagetracerjs).
 */

const OPTIONS = {
  numberofcolors: 16,
  colorsampling: 2,   // deterministic grid sampling — 1 samples at random
  colorquantcycles: 3,
  ltres: 1,
  qtres: 1,
  pathomit: 8,
  rightangleenhance: false,
  strokewidth: 0,
  linefilter: true,
  blurradius: 0,
  scale: 1,
  roundcoords: 1,
}

/**
 * Crop a PNG blob to non-transparent/non-white content with 4% padding,
 * then resize to max 2000px. Keeps fine detail (serifs, thin strokes) that a
 * smaller cap destroyed, while still avoiding empty space.
 */
function preprocessBlob(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const { data } = ctx.getImageData(0, 0, W, H)
      let x0 = W, y0 = H, x1 = 0, y1 = 0, found = false
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4
          const a = data[i + 3], r = data[i], g = data[i + 1], b = data[i + 2]
          if (a > 30 && (r < 240 || g < 240 || b < 240)) {
            if (x < x0) x0 = x; if (y < y0) y0 = y
            if (x > x1) x1 = x; if (y > y1) y1 = y
            found = true
          }
        }
      }
      if (!found || x1 <= x0 || y1 <= y0) { resolve(blob); return }
      const pad = Math.max(8, Math.round(Math.max(x1 - x0, y1 - y0) * 0.04))
      const sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad)
      const sw = Math.min(W - sx, x1 - x0 + pad * 2)
      const sh = Math.min(H - sy, y1 - y0 + pad * 2)
      const MAX = 2000
      const scale = Math.min(1, MAX / Math.max(sw, sh))
      const out = document.createElement('canvas')
      out.width = Math.round(sw * scale); out.height = Math.round(sh * scale)
      out.getContext('2d').drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height)
      out.toBlob(b => resolve(b || blob), 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob) }
    img.src = url
  })
}

/**
 * Vectorize a PNG Blob → SVG string.
 * @param {Blob} blob - PNG with transparent or white background
 * @param {Array<{r:number,g:number,b:number,a:number}>} [pal] - exact colours to
 *   trace with. Pass this when the raster was already reduced to thread colours:
 *   left to itself the tracer runs its own clustering over an image that was
 *   already clustered, so the fills drift off the threads and then snap onto a
 *   *different* thread later — that is how a black pupil came out white.
 * @returns {Promise<string>} SVG markup
 */
function vectorizeBlob(blob, pal) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0)
        let opts = OPTIONS
        if (pal && pal.length) {
          opts = {
            ...OPTIONS,
            // A transparent entry of its own, or the cut-out background has to
            // pick some thread and comes back as a solid black slab. It must be
            // black: the canvas premultiplies, so a transparent pixel reads back
            // as 0,0,0,0 whatever colour it had.
            pal: [{ r: 0, g: 0, b: 0, a: 0 }, ...pal],
            numberofcolors: pal.length + 1,
            // One pass only: further cycles average the palette back off the
            // exact thread colours we just pinned.
            colorquantcycles: 1,
          }
        }
        let svg = window.ImageTracer.imagedataToSVG(ctx.getImageData(0, 0, c.width, c.height), opts)
        // The transparent layer traces to invisible paths — drop them so they
        // do not show up as a phantom colour group.
        svg = svg.replace(/<path[^>]*opacity="0"[^>]*\/>/g, '')
        resolve(svg)
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

/* Повний шлях з README: обрізати поля → звести до ниток → трасувати з
   прибитою палітрою. Те саме, що quantizeToThreads, лише список ниток
   лишається з кодами: у палітрі є нитки з однаковим кольором (1133/1134,
   3303/3340…), і повернути код за кольором було б угадуванням. */
function quantizeWithCodes(blob, maxColors) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const W = img.naturalWidth, H = img.naturalHeight
        const c = document.createElement('canvas')
        c.width = W; c.height = H
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        const imageData = ctx.getImageData(0, 0, W, H)
        const { threads } = quantizePixels(imageData.data, W, H, maxColors)
        if (!threads.length) { resolve({ blob, threads: [], palette: null }); return }
        ctx.putImageData(imageData, 0, 0)
        const palette = threads.map(t => ({ r: t.rgb[0], g: t.rgb[1], b: t.rgb[2], a: 255 }))
        c.toBlob(b => resolve({ blob: b || blob, threads, palette }), 'image/png')
      } catch (e) {
        console.warn('[Quantize] failed', e)
        resolve({ blob, threads: [], palette: null })
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ blob, threads: [], palette: null }) }
    img.src = url
  })
}
async function run(file, maxColors) {
  const prepared = await preprocessBlob(file)
  const q = await quantizeWithCodes(prepared, maxColors || 12)
  const svg = q.palette ? await vectorizeBlob(q.blob, q.palette) : ''      // palette — ОБОВ'ЯЗКОВО
  return { svg, png: q.blob, threads: q.threads }
}

window.LQThreads = { THREAD_PALETTE, quantizeToThreads, quantizePixels, preprocessBlob,
                     vectorizeBlob, paletteByColour, nearestThread, rgbToLab, deltaE, run }
})();
