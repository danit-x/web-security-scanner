#!/usr/bin/env bash
# qa/scripts/wait-for.sh URL [URL...]
# Waits (up to 60 s each) until every URL answers over HTTP. Used by CI after
# starting servers in the background, instead of a fixed `sleep`.
set -euo pipefail
for url in "$@"; do
  for i in $(seq 1 60); do
    if curl -s -o /dev/null "$url"; then
      echo "up: $url"
      continue 2
    fi
    sleep 1
  done
  echo "timed out waiting for $url" >&2
  exit 1
done
