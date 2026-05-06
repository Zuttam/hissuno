#!/usr/bin/env bash
# record-pr.sh <issue-id> <pr-url>
#
# Atomically marks an issue as resolved and writes its PR URL back to Hissuno
# in a single PATCH. Used at the end of the continuous-dev loop.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: record-pr.sh <issue-id> <pr-url>" >&2
  exit 2
fi

id=$1
url=$2

if [ -z "$url" ]; then
  echo "record-pr.sh: pr-url is empty" >&2
  exit 2
fi

hissuno update issues "$id" --status resolved --pr-url "$url"
