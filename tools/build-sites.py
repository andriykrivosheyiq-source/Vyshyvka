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
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'index.html')
CONFIG = os.path.join(ROOT, 'tools', 'sites.json')

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


def apply_garments(html, cfg):
    """Власні вироби ніші (кітель, фартух) — додаються до спільного списку."""
    items = cfg.get('garments') or []
    if not items:
        return html
    first = cfg.get('garmentsFirst')     # ставити власні вироби на початок списку
    code = ',\n'.join(g['code'].rstrip(',') for g in items)
    if first:
        head = "    var GARMENTS = [\n"
        if head not in html:
            raise BuildError('не знайшов початок списку виробів')
        at = html.index(head) + len(head)
        html = html[:at] + code + ',\n' + html[at:]
    else:
        anchor = "      {id:'tote', name:'Шопер', price:90,"
        if anchor not in html:
            raise BuildError('не знайшов кінець списку виробів для вставки власних')
        tail = html.index('\n    ];', html.index(anchor))
        html = html[:tail] + ',\n' + code + html[tail:]

    names = ', '.join('%s:1' % g['id'] for g in items)
    html = re.sub(r'(var NAME_NO_SUFFIX = \{[^}]*)\}',
                  lambda m: m.group(1) + ', ' + names + '}', html, count=1)

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
    return html


def apply_texts(html, cfg):
    missing = []
    for old, new in (cfg.get('texts') or {}).items():
        # шляхи вже зроблено абсолютними, тож і ключі, і заміни звіряємо в тому ж вигляді
        # (інакше відносний images/… з підпапки шукався б у /horeca/images/ і давав 404)
        old = absolutise_images(old)
        new = absolutise_images(new)
        if html.count(old) == 1:
            html = html.replace(old, new, 1)
        elif html.count(old) == 0:
            missing.append(old)
        else:
            html = html.replace(old, new)
    if missing:
        raise BuildError(
            'ці тексти більше не зустрічаються в головному сайті — онови tools/sites.json:\n  '
            + '\n  '.join(t[:110] for t in missing[:8])
        )
    return html


def build(site, cfg, base_html):
    html = base_html
    html = absolutise_images(html)
    html = apply_identity(html, site, cfg)
    html = apply_theme(html, cfg)
    html = apply_home_link(html, cfg)
    html = apply_hero(html, cfg)
    html = apply_niches(html, cfg)
    html = apply_cases(html, cfg)
    html = apply_garments(html, cfg)
    html = apply_texts(html, cfg)
    return html


def main():
    base_html = open(BASE, encoding='utf-8').read()
    config = json.load(open(CONFIG, encoding='utf-8'))
    wanted = sys.argv[1:] or list(config)
    failed = False
    for site in wanted:
        if site not in config:
            print('невідомий сайт: %s' % site)
            failed = True
            continue
        try:
            html = build(site, config[site], base_html)
        except BuildError as e:
            print('[%s] ПОМИЛКА\n  %s' % (site, e))
            failed = True
            continue
        out = os.path.join(ROOT, site, 'index.html')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w', encoding='utf-8').write(html)
        print('[%s] зібрано → %s (%d рядків)' % (site, out, html.count('\n') + 1))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
