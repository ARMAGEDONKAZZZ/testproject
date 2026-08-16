#!/usr/bin/env bash
# Simple helper to commit and push everything in this repo.
# Usage: ./push.sh "commit message"
set -e

if [ -z "$1" ]; then
  echo "Usage: ./push.sh \"commit message\""
  exit 1
fi

git add -A
git commit -m "$1"
git push origin main
