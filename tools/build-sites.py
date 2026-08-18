#!/usr/bin/env python3
"""Збирає нішеві сайти (/horeca/, /build/) з коду головного сайту.

Головний index.html — єдиний еталон структури, стилів і логіки.
tools/sites.json — те, чим ніші відрізняються: тема, тексти, фото, шлях.

    python3 tools/build-sites.py            # зібрати всі ніші
    python3 tools/build-sites.py horeca     # зібрати одну

Кожна текстова заміна перевіряється: якщо рядок-оригінал зник із головного
(наприклад, ми переписали заголовок), збірка падає з поясненням, а не мовчки
лишає нішевий сайт зі старим текстом.
"""
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'index.html')
CONFIG = os.path.join(ROOT, 'tools', 'sites.json')
# Конструктор живе окремим файлом і підключається і сайтом, і сторінкою
# пропозиції. Ніші відрізняються складом виробів, тож кожна дістає власну копію.
CTOR = 'loomiq-constructor.js'
CTOR_PATH = os.path.join(ROOT, CTOR)
STAMPED = ('index.html', 'offer.html')

HERO_CONTROLS = """    <div class="hero-slide-controls">
      <div class="hero-slide-dots" id="heroSlideDots"></div>
      <button class="hero-pause-btn" id="heroPauseBtn" aria-label="Пауза">
        <svg class="hero-pause-ring" viewBox="0 0 34 34">
          <circle class="ring-bg" cx="17" cy="17" r="16"></circle>
          <circle class="ring-fill animating" id="heroRingFill" cx="17" cy="17" r="16"></circle>
        </svg>
        <svg class="hero-pause-icon" id="heroPauseIcon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="5" y="4" width="5" height="16" rx="1"></rect><rect x="14" y="4" width="5" height="16" rx="1"></rect>
        </svg>
      </button>
    </div>
"""


class BuildError(Exception):
    pass


def replace_once(text, old, new, what):
    n = text.count(old)
    if n != 1:
        raise BuildError(
            '%s: очікував рівно один збіг, знайшов %d.\n  Шукав: %s'
            % (what, n, old[:120])
        )
    return text.replace(old, new)


def absolutise_images(html):
    """images/... → /images/..., щоб спрацювало з підпапки /horeca/."""
    html = re.sub(r'(?<![/\w.])images/', '/images/', html)
    return html


def apply_identity(html, site, cfg):
    html = replace_once(html, "LQ_SITE = 'main'", "LQ_SITE = '%s'" % site, 'ідентифікатор сайту')
    html = replace_once(html, "LQ_PHOTOS_DOC = 'photos'",
                        "LQ_PHOTOS_DOC = '%s'" % cfg['photosDoc'], 'документ фото')
    if cfg.get('title'):
        html = re.sub(r'<title>.*?</title>', '<title>%s</title>' % cfg['title'], html, count=1, flags=re.S)
    if cfg.get('description'):
        html = re.sub(r'(<meta name="description" content=")[^"]*(")',
                      lambda m: m.group(1) + cfg['description'] + m.group(2), html, count=1)
    return html


def apply_home_link(html, cfg):
    """«Головна» в меню ніші веде на головний сайт, а не гортає поточну сторінку."""
    old = '<button data-scroll-to="top" id="menuHomeLink"'
    if old not in html:
        raise BuildError('не знайшов кнопку «Головна» в меню')
    return html.replace(old, '<button data-home="/" id="menuHomeLink"', 1)


def apply_theme(html, cfg):
    m = re.search(r':root\{(.*?)\n  \}', html, re.S)
    if not m:
        raise BuildError('не знайшов блок :root із темою')
    block = m.group(1)
    for var, value in cfg.get('theme', {}).items():
        pat = re.compile(re.escape(var) + r':[^;]+;')
        if not pat.search(block):
            raise BuildError('змінна теми %s відсутня в :root' % var)
        block = pat.sub(var + ':' + value + ';', block, count=1)
    return html[:m.start(1)] + block + html[m.end(1):]


def apply_css(html, cfg):
    """Стилізація ніші: темні блоки, затемнення героя, акценти в конструкторі.

    Замінюємо лише тіло правила. Розміри й відступи лишаються з головного —
    у налаштування потрапляють тільки правила, що відрізняються палітрою.
    """
    css = cfg.get('css') or {}
    if not css:
        return html
    head, sep, rest = html.partition('</style>')
    if not sep:
        raise BuildError('не знайшов блок стилів')
    for selector, body in css.items():
        pat = re.compile(r'(\n  ' + re.escape(selector) + r'\{)[^{}]*(\})')
        if not pat.search(head):
            raise BuildError('правило %s зникло з головного — онови tools/sites.json' % selector)
        head = pat.sub(lambda m: m.group(1) + body + m.group(2), head, count=1)
    return head + sep + rest


def apply_hero(html, cfg):
    hero = cfg.get('hero') or {}
    slides = hero.get('slides') or []
    if slides:
        inner = '\n'.join(
            '      <div class="hero-bg-slide%s" style="background-image:url(\'%s\')"></div>'
            % (' active' if i == 0 else '', src) for i, src in enumerate(slides)
        )
        html = re.sub(
            r'(<div class="hero-bg-slides" id="heroBgSlides">).*?(\n    </div>)',
            lambda m: m.group(1) + '\n' + inner + m.group(2),
            html, count=1, flags=re.S,
        )
        if len(slides) > 1 and 'hero-slide-controls' not in html.split('<body')[1]:
            html = replace_once(html, '    <div class="hero-overlay"></div>',
                                HERO_CONTROLS + '    <div class="hero-overlay"></div>',
                                'керування слайдами героя')
    if hero.get('h1'):
        html = re.sub(r'<h1>.*?</h1>', '<h1>%s</h1>' % hero['h1'], html, count=1, flags=re.S)
    if hero.get('lead'):
        html = re.sub(r'<p class="lead">.*?</p>', '<p class="lead">%s</p>' % hero['lead'],
                      html, count=1, flags=re.S)
    return html


def apply_niches(html, cfg):
    cards = cfg.get('niches') or []
    if not cards:
        return html
    blocks = re.findall(r'      <article class="app-card reveal">.*?</article>\n', html, re.S)
    if len(blocks) != len(cards):
        raise BuildError('карток ніш у шаблоні %d, у налаштуваннях %d' % (len(blocks), len(cards)))
    for block, card in zip(blocks, cards):
        photos = card.get('photos') or []
        if len(photos) > 1:
            imgs = '\n'.join(
                '          <img class="iss-img%s" src="%s" alt="%s" loading="lazy">'
                % (' is-active' if i == 0 else '', src, card['title'] if i == 0 else '')
                for i, src in enumerate(photos)
            )
            photo_html = ('        <div class="app-photo industry-stack-photo" data-slideshow>\n'
                          + imgs + '\n        </div>\n')
        else:
            src = photos[0] if photos else ''
            photo_html = ('        <div class="app-photo industry-stack-photo">'
                          '<img src="%s" alt="%s" loading="lazy"></div>\n' % (src, card['title']))
        new_block = (
            '      <article class="app-card reveal">\n'
            '        <div class="app-top"><span class="app-eyebrow">%s</span></div>\n'
            '        <div class="app-bottom"><h3>%s</h3></div>\n'
            '%s'
            '      </article>\n' % (card['title'], card['text'], photo_html)
        )
        html = html.replace(block, new_block, 1)
    return html


def apply_cases(html, cfg):
    """Кейси («Компанії, які вже…»): у кожної ніші свої клієнти й свої позиції."""
    cases = cfg.get('cases') or []
    if not cases:
        return html
    blocks = re.findall(r'      <article class="story-card">\n.*?      </article>\n', html, re.S)
    blocks = [b for b in blocks if 'story-quote' in b and '${' not in b]
    if len(blocks) != len(cases):
        raise BuildError('кейсів у шаблоні %d, у налаштуваннях %d' % (len(blocks), len(cases)))
    for block, c in zip(blocks, cases):
        pills = '\n'.join('            <span class="tag-pill">%s</span>' % p for p in c.get('pills', []))
        new_block = (
            '      <article class="story-card">\n'
            '        <div class="story-photo">\n'
            '          <img src="%s" alt="%s" decoding="async">\n'
            '        </div>\n'
            '        <div class="story-content">\n'
            '          <span class="story-tag">%s</span>\n'
            '          <p class="story-quote">%s</p>\n'
            '          <div class="story-tags">\n%s\n          </div>\n'
            '        </div>\n'
            '      </article>\n' % (absolutise_images(c['img']), c['alt'], c['tag'], c['quote'], pills)
        )
        html = html.replace(block, new_block, 1)
    return html


def apply_garments(html, ctor, cfg):
    """Власні вироби ніші (кітель, фартух) — додаються до спільного списку.

    Список виробів переїхав у конструктор, а каталог лишився на сторінці —
    тому правки лягають у два файли, а не в один."""
    items = cfg.get('garments') or []
    if not items:
        return html, ctor
    first = cfg.get('garmentsFirst')     # ставити власні вироби на початок списку
    code = ',\n'.join(g['code'].rstrip(',') for g in items)
    if first:
        head = "    var GARMENTS = [\n"
        if head not in ctor:
            raise BuildError('не знайшов початок списку виробів у конструкторі')
        at = ctor.index(head) + len(head)
        ctor = ctor[:at] + code + ',\n' + ctor[at:]
    else:
        anchor = "      {id:'tote', name:'Шопер', price:90,"
        if anchor not in ctor:
            raise BuildError('не знайшов кінець списку виробів для вставки власних')
        tail = ctor.index('\n    ];', ctor.index(anchor))
        ctor = ctor[:tail] + ',\n' + code + ctor[tail:]

    names = ', '.join('%s:1' % g['id'] for g in items)
    ctor = re.sub(r'(var NAME_NO_SUFFIX = \{[^}]*)\}',
                  lambda m: m.group(1) + ', ' + names + '}', ctor, count=1)

    cat = ',\n    '.join(g['catalog'] for g in items if g.get('catalog'))
    if cat:
        head = "  const baseCatalogProducts = [\n"
        if head not in html:
            raise BuildError('не знайшов список товарів каталогу')
        if first:
            at = html.index(head) + len(head)
            html = html[:at] + '    ' + cat + ',\n' + html[at:]
        else:
            end = html.index('\n  ];', html.index(head))
            html = html[:end] + ',\n    ' + cat + html[end:]
    return html, ctor


def apply_texts(html, ctor, cfg):
    """Тексти ніші. Шукаємо і на сторінці, і в конструкторі: після винесення
    конструктора в окремий файл частина рядків (вироби, кольори, відгуки)
    живе саме там. Рядок, якого немає ніде, — це помилка збірки, а не привід
    мовчки лишити нішевий сайт зі старим текстом."""
    missing = []
    for old, new in (cfg.get('texts') or {}).items():
        # шляхи вже зроблено абсолютними, тож і ключі, і заміни звіряємо в тому ж вигляді
        # (інакше відносний images/… з підпапки шукався б у /horeca/images/ і давав 404)
        old = absolutise_images(old)
        new = absolutise_images(new)
        if html.count(old):
            html = html.replace(old, new)
        elif ctor.count(old):
            ctor = ctor.replace(old, new)
        else:
            missing.append(old)
    if missing:
        raise BuildError(
            'ці тексти більше не зустрічаються ні на сторінці, ні в конструкторі '
            '— онови tools/sites.json:\n  '
            + '\n  '.join(t[:110] for t in missing[:8])
        )
    return html, ctor


def stamp(path, name, ver):
    """Позначку версії підставляємо в АДРЕСУ файлу.

    Інакше браузер лишався б зі старим конструктором ще годину після
    оновлення сайту: сторінка нова, скрипт із кешу — і менеджер не розуміє,
    чому виправлене досі не виправлене."""
    return re.sub(r'(?<=/)?' + re.escape(name) + r'\?v=[A-Za-z0-9]+',
                  name + '?v=' + ver, path)


def ctor_version(code):
    return hashlib.sha1(code.encode('utf-8')).hexdigest()[:10]


def build(site, cfg, base_html, base_ctor):
    """Сторінка ніші плюс її власна копія конструктора.

    Список виробів у ніші свій (кітель, фартух), а він живе саме в
    конструкторі — тож окремої копії не уникнути. Решта коду в ній
    побайтово та сама, що на головному сайті."""
    ctor = absolutise_images(base_ctor)
    html = base_html
    html = absolutise_images(html)
    html = apply_identity(html, site, cfg)
    html = apply_theme(html, cfg)
    html = apply_home_link(html, cfg)
    html = apply_css(html, cfg)
    html = apply_hero(html, cfg)
    html = apply_niches(html, cfg)
    html = apply_cases(html, cfg)
    html, ctor = apply_garments(html, ctor, cfg)
    html, ctor = apply_texts(html, ctor, cfg)
    html = stamp(html, CTOR, ctor_version(ctor))
    return html, ctor


def main():
    base_html = open(BASE, encoding='utf-8').read()
    base_ctor = open(CTOR_PATH, encoding='utf-8').read()
    config = json.load(open(CONFIG, encoding='utf-8'))

    # Головний сайт і сторінка пропозиції беруть конструктор як є — їм
    # потрібна лише свіжа позначка версії в адресі
    ver = ctor_version(base_ctor)
    for name in STAMPED:
        path = os.path.join(ROOT, name)
        if not os.path.exists(path):
            continue
        txt = open(path, encoding='utf-8').read()
        new = stamp(txt, CTOR, ver)
        if new != txt:
            open(path, 'w', encoding='utf-8').write(new)
            print('[%s] версія конструктора → %s' % (name, ver))

    wanted = sys.argv[1:] or list(config)
    failed = False
    for site in wanted:
        if site not in config:
            print('невідомий сайт: %s' % site)
            failed = True
            continue
        try:
            html, ctor = build(site, config[site], base_html, base_ctor)
        except BuildError as e:
            print('[%s] ПОМИЛКА\n  %s' % (site, e))
            failed = True
            continue
        out = os.path.join(ROOT, site, 'index.html')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w', encoding='utf-8').write(html)
        open(os.path.join(ROOT, site, CTOR), 'w', encoding='utf-8').write(ctor)
        print('[%s] зібрано → %s (%d рядків) + %s' % (site, out, html.count('\n') + 1, CTOR))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
