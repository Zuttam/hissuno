---
title: "Claude Code Skills"
description: "Use Claude Code skills to query Hissuno while you code."
---

## Overview

Claude Code skills are contextual guides that teach Claude Code how to use specific tools. With the Hissuno CLI configured, a skill file tells Claude Code what data is available and how to query it - so you can ask about customer feedback, search for bugs, or check issue status without leaving your editor.

## Prerequisites

1. **Claude Code** installed and working in your project
2. **Hissuno CLI** installed and configured (`npm install -g hissuno && hissuno config`)

## Setup

### Install the Skill

Run from your project root:

```bash
curl -fsSL hissuno.com/skills.sh | bash
```

This creates `.claude/skills/hissuno/` with the skill definition and reference files. Run the same command again to update to the latest version.

## Usage

Once configured, Claude Code can use Hissuno data during your coding sessions. Examples:

- **Before refactoring:** "Are there any customer complaints about the checkout flow?"
- **During a bug fix:** "Search for issues related to authentication timeouts"
- **While planning:** "What are the highest-priority open feature requests?"
- **During code review:** "What do customers say about the onboarding experience?"

The skill is triggered automatically when Claude Code detects relevant context, or you can invoke it directly by referencing Hissuno in your prompts.

## How It Works

1. Claude Code reads the skill file to understand what Hissuno tools are available
2. When you ask a question that matches the skill's description, Claude Code uses the CLI to query Hissuno
3. Results are returned inline in your conversation, alongside your code context

The skill file acts as a guide - it tells Claude Code when and how to use the Hissuno CLI. The actual data access happens through the CLI connection.
