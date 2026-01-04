#!/bin/bash
# Moves a plan from pending/ to done/ and updates its status

set -e

PLANS_DIR=".claude/plans"
PENDING_DIR="$PLANS_DIR/pending"
DONE_DIR="$PLANS_DIR/done"

if [ -z "$1" ]; then
    echo "Usage: $0 <plan-filename>"
    echo ""
    echo "Available pending plans:"
    ls -1 "$PENDING_DIR" 2>/dev/null || echo "  (none)"
    exit 1
fi

FILENAME="$1"
SOURCE="$PENDING_DIR/$FILENAME"
DEST="$DONE_DIR/$FILENAME"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Plan not found at $SOURCE"
    echo ""
    echo "Available pending plans:"
    ls -1 "$PENDING_DIR" 2>/dev/null || echo "  (none)"
    exit 1
fi

# Create done directory if it doesn't exist
mkdir -p "$DONE_DIR"

# Update status in frontmatter and move file
sed 's/^status: pending/status: completed/' "$SOURCE" > "$DEST"
rm "$SOURCE"

echo "Plan completed: $FILENAME"
echo "Moved to: $DEST"
