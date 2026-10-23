#!/bin/sh
# ВИКЛАДКА (23.10). Андрій: «один прогін усіх сторожів перед кожною
# викладкою». У main — лише звідси: повний прогін усіх тестів (три
# паралельно), ті, що впали, — ще раз поодинці (навантаження дає хибні
# падіння: crm-pics, fresh-build, talk-guard); чисто — злиття в main
# (--no-ff) і push. Інакше — список падінь і нічого не зливається.
#   Запуск:  tools/release.sh "Злиття: що саме"      (з гілки роботи)
set -e
cd "$(dirname "$0")/.."
BR=$(git rev-parse --abbrev-ref HEAD)
MSG=${1:-"Злиття: $BR"}
[ "$BR" = "main" ] && { echo "✗ запускати з гілки роботи, не з main"; exit 1; }
[ -n "$(git status --porcelain)" ] && { echo "✗ є незакомічені зміни"; exit 1; }
LOG=${LQ_TEST_LOG:-/tmp/lq-release}; mkdir -p "$LOG"
echo "▶ повний прогін ($(ls tests/*.mjs | wc -l) тестів)…"
ls tests/*.mjs | xargs -P3 -I{} sh -c "node {} >$LOG/\$(basename {}).log 2>&1 || echo {}" > "$LOG/fails.txt"
FAILS=$(cat "$LOG/fails.txt")
AGAIN=""
for t in $FAILS; do
  echo "  ↻ поодинці: $t"
  node "$t" >"$LOG/$(basename "$t").log" 2>&1 || AGAIN="$AGAIN $t"
done
if [ -n "$AGAIN" ]; then
  echo "✗ не зливаємо — падають і поодинці:"
  for t in $AGAIN; do echo "   $t"; grep '✗' "$LOG/$(basename "$t").log" | head -3; done
  exit 1
fi
echo "✓ усі тести чисті"
git fetch -q origin main
git checkout -q main
git merge --no-ff -q "$BR" -m "$MSG"
git push origin main
git checkout -q "$BR"
echo "✓ злито в main: $MSG"
