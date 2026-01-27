# Hissuno Production Deployment Plan

Deploy the Hissuno Next.js + Mastra application to Vercel and migrate from local Supabase to Supabase Cloud.

---

## Phase 1: Supabase Cloud Setup

### 1.1 Create Supabase Cloud Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Choose a region close to your target users (consider proximity to Vercel's edge functions)
3. Set a strong database password and save it securely
4. Wait for the project to finish provisioning (~2 minutes)

### 1.2 Run Database Migrations

Link your local Supabase CLI to the remote project and push migrations:

```bash
cd app
supabase link --project-ref <your-project-ref>
supabase db push
```

This will apply all 14 migrations from `supabase/migrations/`.

### 1.3 Create Storage Buckets

Your app requires 3 storage buckets (defined in `supabase/config.toml`):

| Bucket | Public | Size Limit | Allowed MIME Types |
|--------|--------|------------|-------------------|
| `codebases` | No | 100 MiB | All types |
| `knowledge` | No | 10 MiB | `text/markdown`, `text/plain` |
| `documents` | No | 50 MiB | PDF, Markdown, Word docs |

Create these via **Supabase Dashboard > Storage > New bucket**, matching the config settings.

### 1.4 Configure Authentication

#### Site URL Configuration
Go to **Authentication > URL Configuration**:
- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: Add `https://your-domain.com/auth/callback`

#### GitHub OAuth Provider
Go to **Authentication > Providers > GitHub**:
1. Enable the GitHub provider toggle
2. Enter your **production** GitHub OAuth App credentials:
   - **Client ID**: From your GitHub OAuth App
   - **Client Secret**: From your GitHub OAuth App
3. Copy the callback URL shown (format: `https://<project-ref>.supabase.co/auth/v1/callback`)
4. Update your GitHub OAuth App with this callback URL

> **Note**: The GitHub OAuth credentials are configured in the **Supabase Dashboard**, NOT as Vercel environment variables.

### 1.5 Collect Supabase Credentials

From **Project Settings > API**, note down:

| Credential | Where to Find | Usage |
|------------|---------------|-------|
| Project URL | API Settings | `NEXT_PUBLIC_SUPABASE_URL` |
| anon/public key | API Settings | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role key | API Settings | `SUPABASE_SERVICE_ROLE_KEY` |
| Connection string | Database > Connection string > URI | `DATABASE_URL` |

**Important**: For `DATABASE_URL`, use the **pooler connection string** (port 6543), not the direct connection (port 5432). This works better with Vercel's serverless functions.

---

## Phase 2: Vercel Deployment

### 2.1 Connect Repository to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `app`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 2.2 Configure Environment Variables

Add these environment variables in **Vercel Dashboard > Settings > Environment Variables**:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Database (for Mastra PostgresStore)
# Use the POOLER connection string (port 6543)
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

# OpenAI (for AI agents)
OPENAI_API_KEY=<your-openai-api-key>
```

### 2.3 Configure Custom Domain

1. Go to **Vercel Dashboard > Project > Settings > Domains**
2. Add your custom domain
3. Configure DNS records as instructed by Vercel:
   - For apex domain: Add an `A` record pointing to Vercel's IP
   - For subdomain: Add a `CNAME` record pointing to `cname.vercel-dns.com`
4. HTTPS is enabled automatically

### 2.4 Deploy

Trigger the first deployment:
- Push to your main branch, OR
- Click "Deploy" in Vercel dashboard

---

## Phase 3: Post-Deployment Configuration

### 3.1 Update Supabase Auth URLs

After your Vercel deployment is live with the custom domain:

1. Go to **Supabase Dashboard > Authentication > URL Configuration**
2. Update:
   - **Site URL**: `https://your-domain.com`
   - **Redirect URLs**: Ensure `https://your-domain.com/auth/callback` is listed

### 3.2 Update GitHub OAuth App

Go to your GitHub OAuth App settings:
1. **Homepage URL**: `https://your-domain.com`
2. **Authorization callback URL**: `https://<project-ref>.supabase.co/auth/v1/callback`

### 3.3 Verify Mastra Schema

The Mastra PostgresStore will auto-create tables in the `mastra` schema on first use. After deployment, you can verify by running this query in the Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'mastra';
```

Expected tables include workflow runs, agent threads, etc.

### 3.4 Test Critical Flows

1. **Authentication**: Sign in via GitHub OAuth
2. **Project Creation**: Create a new project
3. **Codebase Upload**: Upload a codebase folder or sync from GitHub
4. **Agent Chat**: Test an AI agent conversation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                           VERCEL                                 │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │    Next.js App      │  │   Mastra Agents & Workflows      │  │
│  │  (Pages, API Routes)│  │  (PostgresStore in mastra schema)│  │
│  └─────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                │                        │
                ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE CLOUD                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │     Auth     │  │  PostgreSQL  │  │   Storage Buckets     │  │
│  │ (GitHub OAuth│  │  (app tables │  │  - codebases          │  │
│  │   provider)  │  │   + mastra)  │  │  - knowledge          │  │
│  └──────────────┘  └──────────────┘  │  - documents          │  │
│                                       └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                │                        │
                ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                            │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │      OpenAI API      │  │         GitHub API              │  │
│  │   (AI agent models)  │  │ (repo sync, OAuth, code access) │  │
│  └──────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Summary

### Vercel Environment Variables

| Variable | Source | Public/Secret |
|----------|--------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard > API | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard > API | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > API | **Secret** |
| `DATABASE_URL` | Supabase Dashboard > Database | **Secret** |
| `OPENAI_API_KEY` | OpenAI Dashboard | **Secret** |

### Supabase Dashboard Configuration

| Setting | Location |
|---------|----------|
| GitHub OAuth Client ID | Authentication > Providers > GitHub |
| GitHub OAuth Client Secret | Authentication > Providers > GitHub |
| Site URL | Authentication > URL Configuration |
| Redirect URLs | Authentication > URL Configuration |

---

## Deployment Checklist

### Supabase Cloud Setup
- [ ] Create Supabase Cloud project
- [ ] Link local CLI: `supabase link --project-ref <ref>`
- [ ] Push migrations: `supabase db push`
- [ ] Create `codebases` storage bucket (private, 100 MiB limit)
- [ ] Create `knowledge` storage bucket (private, 10 MiB limit)
- [ ] Create `documents` storage bucket (private, 50 MiB limit)
- [ ] Configure Site URL in Authentication settings
- [ ] Add redirect URL: `https://your-domain.com/auth/callback`
- [ ] Enable GitHub OAuth provider with production credentials
- [ ] Note down Project URL, anon key, service role key
- [ ] Note down pooler connection string for DATABASE_URL

### Vercel Deployment
- [ ] Import repository to Vercel
- [ ] Set root directory to `app`
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` env var
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` env var
- [ ] Add `DATABASE_URL` env var (pooler connection)
- [ ] Add `OPENAI_API_KEY` env var
- [ ] Configure custom domain
- [ ] Configure DNS records
- [ ] Trigger first deployment
- [ ] Verify build succeeds

### Post-Deployment
- [ ] Update Supabase Site URL with production domain
- [ ] Update Supabase redirect URLs with production domain
- [ ] Update GitHub OAuth App callback and homepage URLs
- [ ] Verify Mastra schema tables are created
- [ ] Test GitHub OAuth sign-in
- [ ] Test project creation
- [ ] Test codebase upload
- [ ] Test AI agent chat

---

## Troubleshooting

### Database Connection Issues

**Symptom**: `ECONNREFUSED` or connection timeout errors

**Solution**: 
- Use the **pooler** connection string (port 6543), not direct connection (port 5432)
- Pooler format: `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

**Symptom**: Authentication errors with special characters in password

**Solution**: URL-encode special characters in the password (e.g., `@` → `%40`)

### Storage Bucket Errors

**Symptom**: "Bucket not found" errors

**Solution**:
- Verify buckets are created with exact names: `codebases`, `knowledge`, `documents`
- Check that RLS policies from migrations are applied

### OAuth Redirect Errors

**Symptom**: "Invalid redirect URL" or callback errors

**Solution**:
- Ensure Supabase redirect URLs include your exact production domain
- Verify GitHub OAuth App callback URL matches: `https://<project-ref>.supabase.co/auth/v1/callback`
- Check for trailing slashes (they matter!)

### Mastra Tables Not Created

**Symptom**: Agent/workflow errors about missing tables

**Solution**:
- Tables are created lazily on first Mastra storage operation
- Trigger an agent call or workflow to initialize the schema
- Check database logs for any permission issues
- Verify `DATABASE_URL` uses the correct connection string

### Build Failures on Vercel

**Symptom**: Build fails with module not found errors

**Solution**:
- Ensure root directory is set to `app`
- Check that all dependencies are in `package.json` (not just devDependencies)
- Verify `next.config.ts` serverExternalPackages includes pino dependencies

---

## Security Reminders

1. **Never commit secrets**: Keep `.env` files in `.gitignore`
2. **Use service role key carefully**: Only for server-side operations that bypass RLS
3. **Rotate keys if exposed**: Regenerate in Supabase Dashboard > API if compromised
4. **Review RLS policies**: Ensure storage bucket policies are restrictive
