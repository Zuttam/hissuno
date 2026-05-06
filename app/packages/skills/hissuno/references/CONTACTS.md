# Contacts

Individual customer contacts with linked feedback history and company associations. Part of the "customers" umbrella alongside companies.

## Listing

```bash
hissuno list customers                              # List contacts (default)
hissuno list customers --customer-type contacts      # Explicit contacts
hissuno list customers --search "john" --limit 5
hissuno list customers --company-id <uuid>
```

| Filter | CLI Option | Values |
|--------|-----------|--------|
| search | `--search <query>` | Search by name or email |
| company_id | `--company-id <id>` | Filter by company UUID |
| role | `--role <role>` | Filter by role |

## Detail

`hissuno get customers <id>` returns:

- Name, email, phone, title, role
- Company association (company ID and URL)
- Champion status
- Last contacted timestamp
- Notes, custom fields
- **Relationships** - linked feedback sessions, issues, companies, knowledge, product scopes

## Search

Semantic vector search. Falls back to name/email text matching for contacts without embeddings.

```bash
hissuno search "john" --type customers
```

## Creation

```bash
hissuno add customers                          # Prompts for sub-type
hissuno add customers --customer-type contacts # Direct to contact creation
```

Interactive prompts:
1. Name (required)
2. Email (required)
3. Role (optional)
4. Title (optional)
5. Phone (optional)
6. Company ID (optional)
7. Is champion? (optional)


## Relationships

Contacts connect to:
- **Companies** - the organization they belong to
- **Feedback sessions** - conversations from this contact
- **Issues** - bugs or requests they reported
- **Knowledge sources** - documentation they referenced
- **Product scopes** - product areas they engage with

## CLI Examples

```bash
hissuno list customers --search "john" --limit 5
hissuno list customers --company-id <uuid>
hissuno get customers <id>
hissuno add customers --customer-type contacts
```
