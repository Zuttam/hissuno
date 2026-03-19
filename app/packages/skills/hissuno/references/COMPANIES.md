# Companies

Customer companies with revenue data, health scores, and contact associations. Part of the "customers" umbrella alongside contacts.

## CLI Support

Companies are accessible via the `customers` type with `--customer-type companies`.

```bash
hissuno list customers --customer-type companies                      # List all companies
hissuno list customers --customer-type companies --stage active       # Filter by stage
hissuno list customers --customer-type companies --industry SaaS      # Filter by industry
hissuno get customers <id> --customer-type companies                  # Company details
hissuno add customers --customer-type companies                       # Create a company
```

## Key Fields

| Field | Type | Description |
|-------|------|-------------|
| name | string | Company name |
| domain | string | Company domain (e.g., acme.com) |
| industry | string | Industry sector |
| arr | number | Annual recurring revenue |
| stage | string | Customer stage (prospect, active, churned, etc.) |
| health_score | integer | 0-100 health score |
| renewal_date | timestamp | Next renewal date |
| plan_tier | string | Subscription tier |

## Relationships

Companies connect to:
- **Contacts** - people at this company
- **Feedback sessions** - conversations from company contacts
- **Issues** - bugs or requests affecting this company
- **Knowledge sources** - relevant documentation
- **Product scopes** - product areas this company uses

## CLI Examples

```bash
hissuno list customers --customer-type companies                      # List all companies
hissuno list customers --customer-type companies --stage active       # Active companies
hissuno list customers --customer-type companies --search "acme"      # Search by name/domain
hissuno get customers <id> --customer-type companies                  # Full company details
hissuno add customers --customer-type companies                       # Create interactively
```

Also accessible through relationships:
- Contact relationships: `hissuno get customers <contact-id>` shows the linked company
- Issue/feedback relationships: `hissuno get issues <id>` shows related companies in the graph
