# Product Scopes

Product areas and initiatives that organize your product into logical groupings. Each scope can have goals - measurable objectives that issues and feedback align against.

CLI type: `scopes` | Entity type in graph: `product_scope`

## Types

| Type | Description |
|------|-------------|
| `product_area` | A permanent area of the product (e.g., "Reporting", "API Platform") |
| `initiative` | A time-bound effort (e.g., "Q1 Mobile Launch", "Auth Migration") |

## Listing

No filters available. `hissuno list scopes` returns all scopes ordered by position.

## Detail

`hissuno get scopes <id>` returns:

- Name, type (product_area or initiative), description
- Color, position, is_default flag
- Goals array: `[{id, text}]`
- **Relationships** - linked issues, feedback sessions, contacts, companies, knowledge, codebases

## Search

Not available via CLI search. Browse scopes with `list` or look up by ID with `get`.

## Creation

```bash
hissuno add scopes
```

Interactive prompts:
1. Name (required)
2. Type: product_area or initiative (required)
3. Description (optional)
4. Goals (optional, loop: enter goal text, empty to finish, max 10)

**API add fields:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Scope name |
| `type` | Yes | string | `product_area` or `initiative` |
| `description` | No | string | Scope description |
| `goals` | No | array | `[{id, text}]` - measurable objectives |

## Update

```bash
hissuno update scopes <id>
```

Interactive prompts to change name, type, description, or manage goals (add, replace, clear).

**API update fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | New name |
| `type` | string | `product_area` or `initiative` |
| `description` | string | New description |
| `goals` | array or null | Replace goals (null to clear) |

## Goals

Goals are measurable objectives attached to a scope. They serve as alignment targets - when the system reviews feedback or analyzes issues, it checks whether they align with active goals.

Example goals for a "Reporting & Analytics" product area:
- "Enable self-serve data export (CSV, PDF) for non-technical users"
- "Achieve <2s load time for dashboards with 1M+ rows"

Goal IDs follow the format `g_<timestamp>_<index>` when created via CLI.

## Relationships

Product scopes connect to:
- **Issues** - bugs and feature requests in this product area (with optional goal alignment metadata)
- **Feedback sessions** - customer conversations related to this area
- **Contacts** - customers who engage with this area
- **Companies** - organizations using this product area
- **Knowledge sources** - documentation and code for this area

## CLI Examples

```bash
hissuno list scopes                              # List all scopes
hissuno get scopes <id>                          # Full details + relationships
hissuno add scopes                               # Create a new scope
hissuno update scopes <id>                       # Modify scope or goals
```
