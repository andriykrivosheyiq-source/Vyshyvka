#!/usr/bin/env python3
"""Базовий перелік товарів для сторінки каталогу.

НАВІЩО. Каталог для дизайнера (catalog.html) має показувати ВСЕ, що в нас
є, — а товари живуть у двох місцях одразу. Стандартні моделі й кольори
прописані в коді конструктора; фліски, кітелі й решта, заведена менеджером
через адмінку, лежить у базі разом із посиланнями на знімки.

Перша версія каталогу читала лише файли з репозиторію — і половини товарів у
ній не було взагалі: їхніх знімків у репозиторії не існує, вони в сховищі.

Цей скрипт відповідає рівно за половину: дістає з коду конструктора базовий
перелік (моделі, кольори, додаткові ракурси) і кладе його поруч окремим
файлом. Другу половину — те, що завела адмінка, — сторінка бере з бази сама,
наживо. Так каталог не може відстати від конструктора: перелік у них один.

Запуск:  python3 tools/build-catalog.py     (з кореня репозиторію)
Виходить: catalog-base.js
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'catalog-base.js')
CTOR = os.path.join(ROOT, 'loomiq-constructor.js')

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


def main():
    garments, colors, angles = read_catalog()
    data = {
        'garments': [{'id': g['id'], 'name': g['name']} for g in garments],
        'colors': {k: [{'id': c['id'], 'name': c['name'], 'hex': c.get('hex', '')}
                       for c in v] for k, v in colors.items()},
        'angles': angles,
    }
    body = ('/* Створено автоматично: python3 tools/build-catalog.py\n'
            '   Джерело — loomiq-constructor.js. Руками не правити: наступна\n'
            '   збірка це затре, а каталог розійдеться з конструктором. */\n'
            'window.LQ_BASE = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
    open(OUT, 'w', encoding='utf-8').write(body)
    print('[каталог] %s → %d моделей, %d наборів кольорів'
          % (os.path.basename(OUT), len(data['garments']), len(data['colors'])))


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        raise SystemExit('каталог не зібрався: %s' % e)
