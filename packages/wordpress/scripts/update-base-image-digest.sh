#!/bin/sh
# Dockerfile / Dockerfile.dev の FROM 行を、指定タグの最新ダイジェストで固定し直す。
# Usage: scripts/update-base-image-digest.sh [image:tag]
set -eu
cd -- "$(dirname -- "$0")/.."

image="${1:-$(sed -n '1s/^FROM \([^@ ]*\).*/\1/p' Dockerfile)}"

digest=$(docker pull -- "$image" | sed -n 's/^Digest: //p')
if [ -z "$digest" ]; then
  echo "digest not found for $image" >&2
  exit 1
fi

for file in Dockerfile Dockerfile.dev; do
  sed -i -E "1s|^FROM [^ ]+|FROM ${image}@${digest}|" "$file"
done

echo "Pinned to ${image}@${digest}"
