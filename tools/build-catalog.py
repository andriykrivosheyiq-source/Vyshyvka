#!/usr/bin/env python3
"""Каталог товарів для дизайнера — два документи, по одному на напрям.

НАВІЩО. Товари живуть у двох місцях одразу: перелік моделей і кольорів — у
коді конструктора, самі знімки — файлами в images/. Щоб передати дизайнеру
«ось усе, що в нас є», доводилось або показувати сайт і диктувати, або
відкривати папку на 270 файлів із назвами на кшталт `hoodie-vanilla-back`.

Що робить цей скрипт: збирає перелік із коду, звіряє його з файлами на диску
і складає два документи — мерч і HoReCa. Кожен товар окремим розділом, у
ньому кольори, у кольорі ракурси, під кожним знімком точний шлях до файлу.
Документ відкривається в браузері й друкується в PDF без жодних правок.

Заразом видно розбіжності: колір, оголошений у коді, але без знімка, і
знімок, який лежить у папці, але в жодному товарі не значиться. Це не
прикраса — саме такі дірки й спливають у КП порожнім квадратом.

Запуск:  python3 tools/build-catalog.py     (з кореня репозиторію)
Виходить: catalog/merch.html і catalog/horeca.html
"""
import json
import os
import re
import html
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'catalog')
CTOR = os.path.join(ROOT, 'loomiq-constructor.js')

SIDE_UA = {
    'front': 'Перед', 'back': 'Спина', 'left': 'Лівий бік', 'right': 'Правий бік',
    'sleeve': 'Рукав', 'side': 'Бік', 'hood': 'Капюшон', 'visor': 'Козирок',
}


class BuildError(Exception):
    pass


def js_block(src, name, open_ch, close_ch):
    """Вирізати літерал `var NAME = …;` з коду конструктора.

    Рахуємо дужки, а не шукаємо кінець регуляркою: у значеннях трапляються
    і дужки, і крапки з комою, і «розумна» регулярка ламається на першому ж
    товарі з апострофом у назві.
    """
    m = re.search(r'var\s+' + name + r'\s*=\s*' + re.escape(open_ch), src)
    if not m:
        raise BuildError('у конструкторі немає %s' % name)
    i = m.end() - 1
    depth, j, in_str, esc = 0, i, '', False
    while j < len(src):
        c = src[j]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == in_str:
                in_str = ''
        elif c in '"\'':
            in_str = c
        elif c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
        j += 1
    raise BuildError('не знайдено кінець %s' % name)


def js_to_json(text):
    """Літерал JavaScript → JSON. Ключі без лапок, лапки одинарні, коми в кінці."""
    out, i, in_str, esc = [], 0, '', False
    while i < len(text):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == in_str:
                in_str = ''
            out.append('"' if c == "'" and not esc else c)
            i += 1
            continue
        if c in '"\'':
            in_str = c
            out.append('"')
            i += 1
            continue
        out.append(c)
        i += 1
    s = ''.join(out)
    s = re.sub(r'//[^\n]*', '', s)
    s = re.sub(r'/\*[\s\S]*?\*/', '', s)
    s = re.sub(r'([{,]\s*)([A-Za-z_$][\w$]*)\s*:', r'\1"\2":', s)
    s = re.sub(r',\s*([}\]])', r'\1', s)
    return json.loads(s)


def read_catalog():
    src = open(CTOR, encoding='utf-8').read()
    garments = js_to_json(js_block(src, 'GARMENTS', '[', ']'))
    colors = js_to_json(js_block(src, 'GARMENT_COLORS', '{', '}'))
    angles = js_to_json(js_block(src, 'GARMENT_ANGLES', '{', '}'))
    return garments, colors, angles


def shots(images_dir, gid, cid, extra_sides):
    """Які знімки цього кольору справді лежать на диску."""
    out = []
    for side in ['front', 'back'] + list(extra_sides):
        name = '%s-%s-%s.webp' % (gid, cid, side)
        if os.path.exists(os.path.join(images_dir, name)):
            out.append((side, name))
    return out


CSS = """
:root{color-scheme:light;--ink:#141A22;--soft:#5A6472;--muted:#8A94A6;
  --line:#E3E8EF;--paper:#fff;--canvas:#F6F8FB;--warn:#B54708;--warn-bg:#FFF6E8;}
*{box-sizing:border-box;}
body{margin:0;background:var(--canvas);color:var(--ink);
  font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif;}
.page{max-width:1180px;margin:0 auto;padding:40px 28px 80px;}
h1{font-size:36px;line-height:1.1;letter-spacing:-.8px;margin:0 0 6px;}
.sub{color:var(--soft);margin:0 0 6px;}
.meta{color:var(--muted);font-size:13px;margin:0 0 34px;}
.toc{background:var(--paper);border:1px solid var(--line);border-radius:16px;
  padding:16px 18px;margin-bottom:34px;}
.toc b{display:block;font-size:13px;color:var(--soft);margin-bottom:8px;
  text-transform:uppercase;letter-spacing:.08em;}
.toc a{display:inline-block;margin:0 14px 6px 0;color:var(--ink);text-decoration:none;
  border-bottom:1px solid var(--line);}
.g{background:var(--paper);border:1px solid var(--line);border-radius:18px;
  padding:22px 22px 8px;margin-bottom:26px;}
.g > h2{font-size:24px;margin:0 0 2px;letter-spacing:-.4px;}
.g > .gs{color:var(--muted);font-size:13px;margin:0 0 18px;}
.c{border-top:1px solid var(--line);padding:16px 0 4px;}
.c:first-of-type{border-top:0;}
.ch{display:flex;align-items:center;gap:9px;margin-bottom:10px;}
.dot{width:20px;height:20px;border-radius:50%;border:1px solid rgba(0,0,0,.15);flex:none;}
.cn{font-weight:600;}
.cid{color:var(--muted);font-size:12.5px;font-family:ui-monospace,Menlo,monospace;}
.row{display:flex;flex-wrap:wrap;gap:14px;}
.sh{width:170px;}
.sh img{display:block;width:170px;height:212px;object-fit:contain;
  background:var(--canvas);border:1px solid var(--line);border-radius:12px;}
.sh b{display:block;font-size:12.5px;font-weight:600;margin:6px 0 1px;}
.sh code{display:block;font-size:11px;color:var(--muted);word-break:break-all;
  font-family:ui-monospace,Menlo,monospace;}
.miss{font-size:13px;color:var(--warn);background:var(--warn-bg);
  border-radius:10px;padding:8px 11px;margin:4px 0 10px;}
.orphan{background:var(--paper);border:1px solid var(--line);border-radius:18px;
  padding:20px 22px;margin-top:30px;}
.orphan h2{font-size:19px;margin:0 0 4px;}
.orphan p{color:var(--soft);font-size:13.5px;margin:0 0 10px;}
.orphan code{font-size:12px;font-family:ui-monospace,Menlo,monospace;color:var(--soft);
  display:inline-block;margin:0 10px 4px 0;}
@media print{
  body{background:#fff;}
  .page{max-width:none;padding:0;}
  .g,.toc,.orphan{break-inside:avoid;border-radius:0;border:0;border-top:1px solid #ddd;
    padding-left:0;padding-right:0;}
  .sh img{border-radius:0;}
}
"""


EXTRA_UA = [
    ('model-',  'На моделях', 'Знімки виробів на людях — для сторінок і пропозицій.'),
    ('work-',   'Наші роботи', 'Портфоліо: що вже зроблено для клієнтів.'),
    ('niche-',  'Напрямки', 'Знімки під галузі: бар, кухня, доставка, готель.'),
    ('ind-',    'Кому', 'Ілюстрації розділів «для кого це».'),
    ('hero-',   'Обкладинки', 'Великі знімки перших екранів.'),
    ('review-', 'Відгуки', 'Фото до відгуків.'),
    ('kitel',   'Кітель', 'Знімки кітеля — окремим товаром у каталозі ще не заведений.'),
    ('thumb-',  'Мініатюри', ''),
    ('team',    'Команда', ''),
    ('box',     'Пакування', ''),
    ('cap.',        'Значки виробів', 'Пласкі знімки без кольору — з них починався каталог.'),
    ('hoodie.',     'Значки виробів', ''),
    ('sweatshirt.', 'Значки виробів', ''),
    ('tshirt.',     'Значки виробів', ''),
]


def extra_groups(files):
    """Решта зображень — не безлад, а зрозумілі набори.

    Показати дизайнеру «91 файл поза каталогом» означає змусити його
    розбиратись самому. Тому розкладаємо за назвою: `model-…` — знімки на
    людях, `work-…` — портфоліо, і так далі. Що не впізнали — лишається
    окремим списком, і це вже справді питання, а не шум.
    """
    left = list(files)
    out = []
    for pref, name, about in EXTRA_UA:
        hit = sorted(f for f in left if f.startswith(pref))
        if not hit:
            continue
        left = [f for f in left if f not in hit]
        # Кілька префіксів можуть вести в той самий розділ — зливаємо
        same = [g for g in out if g['name'] == name]
        if same:
            same[0]['files'] = sorted(same[0]['files'] + hit)
            if about and not same[0]['about']:
                same[0]['about'] = about
        else:
            out.append({'name': name, 'about': about, 'files': hit})
    return out, sorted(left)


def doc(title, lead, groups, orphans, images_rel):
    parts = ['<!doctype html><html lang="uk"><head><meta charset="utf-8">',
             '<meta name="viewport" content="width=device-width,initial-scale=1">',
             '<title>%s</title><style>%s</style></head><body><div class="page">' %
             (html.escape(title), CSS)]
    total_shots = sum(len(s) for g in groups for _, _, s, _ in g['colors'])
    parts.append('<h1>%s</h1>' % html.escape(title))
    parts.append('<p class="sub">%s</p>' % html.escape(lead))
    parts.append('<p class="meta">%d моделей · %d кольорів · %d знімків. '
                 'Шлях під кожним знімком — це точна назва файлу в репозиторії. '
                 'Нижче, окремими розділами, решта зображень напряму.</p>'
                 % (len(groups), sum(len(g['colors']) for g in groups), total_shots))

    parts.append('<div class="toc"><b>Моделі</b>')
    for g in groups:
        parts.append('<a href="#%s">%s</a>' % (html.escape(g['id']), html.escape(g['name'])))
    parts.append('</div>')

    for g in groups:
        parts.append('<section class="g" id="%s">' % html.escape(g['id']))
        parts.append('<h2>%s</h2>' % html.escape(g['name']))
        parts.append('<p class="gs">%s · %d кольорів · %d знімків</p>'
                     % (html.escape(g['id']), len(g['colors']),
                        sum(len(s) for _, _, s, _ in g['colors'])))
        empty = [n for n, _, s, _ in g['colors'] if not s]
        if empty:
            parts.append('<div class="miss">Без знімків: %s. У конструкторі колір є, '
                         'файлу немає — у пропозиції на його місці буде порожньо.</div>'
                         % html.escape(', '.join(empty)))
        for name, cid, sh, hexv in g['colors']:
            if not sh:
                continue
            parts.append('<div class="c"><div class="ch">'
                         '<span class="dot" style="background:%s"></span>'
                         '<span class="cn">%s</span><span class="cid">%s</span></div>'
                         % (html.escape(hexv or '#eee'), html.escape(name), html.escape(cid)))
            parts.append('<div class="row">')
            for side, fname in sh:
                parts.append('<figure class="sh"><img src="%s/%s" alt="">'
                             '<b>%s</b><code>%s/%s</code></figure>'
                             % (images_rel, html.escape(fname),
                                html.escape(SIDE_UA.get(side, side)),
                                images_rel, html.escape(fname)))
            parts.append('</div></div>')
        parts.append('</section>')

    extras, unknown = extra_groups(orphans)
    for e in extras:
        parts.append('<section class="g"><h2>%s</h2>' % html.escape(e['name']))
        parts.append('<p class="gs">%s%d знімків</p>'
                     % ((html.escape(e['about']) + ' · ') if e['about'] else '',
                        len(e['files'])))
        parts.append('<div class="row">')
        for f in e['files']:
            parts.append('<figure class="sh"><img src="%s/%s" alt="">'
                         '<code>%s/%s</code></figure>'
                         % (images_rel, html.escape(f), images_rel, html.escape(f)))
        parts.append('</div></section>')

    if unknown:
        parts.append('<section class="orphan"><h2>Не впізнали</h2>'
                     '<p>Лежать у папці, але ні до товару, ні до жодного набору '
                     'не належать — або зайві, або щось забули оголосити.</p>')
        for f in unknown:
            parts.append('<code>%s</code>' % html.escape(f))
        parts.append('</section>')

    parts.append('</div></body></html>')
    return '\n'.join(parts)


def build_merch():
    garments, colors, angles = read_catalog()
    images_dir = os.path.join(ROOT, 'images')
    used, groups = set(), []
    for g in garments:
        gid, gname = g['id'], g['name']
        rows = []
        for c in colors.get(gid, []):
            sh = shots(images_dir, gid, c['id'], angles.get(gid, []))
            for _, fname in sh:
                used.add(fname)
            rows.append((c['name'], c['id'], sh, c.get('hex', '')))
        groups.append({'id': gid, 'name': gname, 'colors': rows})
    orphans = [f for f in os.listdir(images_dir)
               if f.endswith('.webp') and f not in used]
    return doc('Каталог мерчу Loomiq',
               'Усе, що можна вдягти логотипом у конструкторі: модель, колір, ракурс.',
               groups, orphans, '../images')


def build_horeca():
    """HoReCa описана не списком кольорів, а самими файлами: apron-<модель>-<колір>."""
    images_dir = os.path.join(ROOT, 'horeca', 'images')
    files = sorted(f for f in os.listdir(images_dir) if f.endswith('.webp'))
    models, orphans = OrderedDict(), []
    palette = {'bk': ('Чорний', '#1a1a1a'), 'wh': ('Білий', '#eeebe4'),
               'gf': ('Графітовий', '#4a4f55'), 'ny': ('Синій', '#1e2d4a'),
               'rd': ('Червоний', '#8b1a1a'), 'sa': ('Пісочний', '#c9b99a')}
    for f in files:
        m = re.match(r'^(apron)-([a-z0-9]+)-([a-z]{2})\.webp$', f)
        if not m:
            orphans.append(f)
            continue
        model = m.group(2)
        models.setdefault(model, []).append((m.group(3), f))
    groups = []
    for model, items in models.items():
        rows = []
        for cid, fname in sorted(items):
            nm, hexv = palette.get(cid, (cid, '#dddddd'))
            rows.append((nm, cid, [('front', fname)], hexv))
        groups.append({'id': 'apron-' + model,
                       'name': 'Фартух ' + model.capitalize(),
                       'colors': rows})
    return doc('Каталог HoReCa Loomiq',
               'Форма для закладів: фартухи в моделях і кольорах, які є на складі знімків.',
               groups, orphans, '../horeca/images')


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, body in (('merch', build_merch()), ('horeca', build_horeca())):
        path = os.path.join(OUT, name + '.html')
        open(path, 'w', encoding='utf-8').write(body)
        print('[каталог] %s → %d КБ' % (path, len(body) // 1024))
    # Знімки лишаються там, де лежать: документ посилається на них відносним
    # шляхом. Копіювати 270 файлів у другу папку означало б тримати дві версії
    # каталогу й рано чи пізно показати дизайнеру стару.


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        raise SystemExit('каталог не зібрався: %s' % e)
