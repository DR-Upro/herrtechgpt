#!/usr/bin/env bash
# Backup aller Wistia-Videos aus module_videos zu Google Drive.
# Download (yt-dlp) → Upload (rclone) → Lokal löschen pro Video.
#
# Usage: bash scripts/backup-videos-to-drive.sh

set -uo pipefail

DRIVE_REMOTE="gdrive:UPRO AI Lab — Video Archive"
WORK_DIR="$HOME/Downloads/upro-videos-work"
LOG_FILE="$HOME/Downloads/upro-video-backup.log"
DB_CONTAINER="supabase_db_upro-ai-lab"

mkdir -p "$WORK_DIR"
echo "=== Start $(date) ===" | tee -a "$LOG_FILE"

# Manifest aus DB ziehen, pipe-delimited: wistia_id|module|chapter|sort|title
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tA -F'|' -c "SELECT v.wistia_hashed_id, COALESCE(m.slug,'_misc'), COALESCE(c.title,''), v.sort_order, v.title FROM public.module_videos v LEFT JOIN public.course_modules m ON m.id = v.module_id LEFT JOIN public.module_chapters c ON c.id = v.chapter_id WHERE v.wistia_hashed_id NOT LIKE 'MISSING%' AND v.wistia_hashed_id IS NOT NULL AND COALESCE(m.slug,'') <> 'live-calls' ORDER BY m.slug, c.sort_order NULLS FIRST, v.sort_order;" > /tmp/upro-video-manifest.txt

TOTAL=$(wc -l < /tmp/upro-video-manifest.txt | tr -d ' ')
COUNT=0

while IFS='|' read -r wistia_id module chapter sort title; do
  COUNT=$((COUNT + 1))
  [ -z "$wistia_id" ] && continue

  # Safe filename
  safe_title=$(echo "$title" | tr '/\\' '__' | tr -d '\000-\037')
  num=$(printf "%03d" "${sort:-0}")
  fname="${num} - ${safe_title}"

  # Target path in Drive
  if [ -n "$chapter" ]; then
    drive_path="${DRIVE_REMOTE}/${module}/${chapter}"
  else
    drive_path="${DRIVE_REMOTE}/${module}"
  fi

  echo "[$COUNT/$TOTAL] $module/$chapter/$fname (wistia: $wistia_id)" | tee -a "$LOG_FILE"

  # Skip if already in Drive
  if rclone lsf "$drive_path/" 2>/dev/null | grep -qF "${fname}.mp4"; then
    echo "  → already in Drive, skip" | tee -a "$LOG_FILE"
    continue
  fi

  # Download — --print after_move:filepath gibt den exakten Pfad zurück
  # (bulletproof gegen Sonderzeichen wie :, /, Emojis im Dateinamen).
  # Kein --restrict-filenames, damit der Drive-Filename mit dem Skip-Check matcht.
  cd "$WORK_DIR" || exit 1
  downloaded=$(yt-dlp --no-warnings --quiet --no-progress \
    -f "best[ext=mp4]/best" \
    -o "${fname}.%(ext)s" \
    --print "after_move:filepath" \
    "https://fast.wistia.net/embed/iframe/${wistia_id}" 2>>"$LOG_FILE")

  if [ -z "$downloaded" ] || [ ! -f "$downloaded" ]; then
    echo "  ✗ download failed (no file)" | tee -a "$LOG_FILE"
    continue
  fi

  # Upload to Drive — exact filename, kein Glob-Risk mehr
  if rclone move --quiet "$downloaded" "$drive_path/" 2>>"$LOG_FILE"; then
    size_bytes=$(stat -f%z "$downloaded" 2>/dev/null || echo "?")
    echo "  ✓ uploaded (${size_bytes} bytes)" | tee -a "$LOG_FILE"
  else
    echo "  ✗ rclone move failed — file bleibt lokal: $downloaded" | tee -a "$LOG_FILE"
  fi

done < /tmp/upro-video-manifest.txt

echo "=== Done $(date) ===" | tee -a "$LOG_FILE"
echo "Files in Drive:" | tee -a "$LOG_FILE"
rclone size "$DRIVE_REMOTE" | tee -a "$LOG_FILE"
