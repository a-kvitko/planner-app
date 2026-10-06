#!/usr/bin/env bash
# Dump incomplete Things Work-area todos → JSON (Inbox/Today/Anytime).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$SCRIPT_DIR/../backups/things-work-dump-$(date +%Y%m%d).json}"
osascript "$SCRIPT_DIR/export-things-work.applescript" > "$OUT"
# Validate JSON
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert 'items' in d; print(f'Wrote {len(d[\"items\"])} items → {sys.argv[1]}')" "$OUT"
echo "$OUT"
