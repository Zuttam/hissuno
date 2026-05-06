#!/usr/bin/env bash
# slugify-branch.sh <issue-id> "<title>"
#
# Print the canonical branch name for an issue: hissuno/<id-prefix>-<slug>
# - id-prefix: first 8 chars of the UUID
# - slug: lowercase ASCII, non-alnum collapsed to '-', no leading/trailing '-'
# - slug capped at 40 chars; total branch name capped at 60 chars

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: slugify-branch.sh <issue-id> \"<title>\"" >&2
  exit 2
fi

id=$1
title=$2

prefix=$(printf '%s' "$id" | cut -c1-8)

slug=$(printf '%s' "$title" \
  | tr '[:upper:]' '[:lower:]' \
  | LC_ALL=C sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')

# Cap slug at 40 chars; trim at last hyphen boundary when possible.
if [ "${#slug}" -gt 40 ]; then
  slug=${slug:0:40}
  slug=${slug%-*}
  # Defensive: if trimming left an empty string, fall back to a plain cut.
  if [ -z "$slug" ]; then
    slug=${2:0:40}
    slug=$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | LC_ALL=C sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
  fi
fi

branch="hissuno/${prefix}-${slug}"

# Hard cap total length at 60 chars.
if [ "${#branch}" -gt 60 ]; then
  branch=${branch:0:60}
  branch=${branch%-}
fi

printf '%s\n' "$branch"
