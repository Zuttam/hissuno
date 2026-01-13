# Onboarding Flow Implementation Plan

## Summary

Implement a 3-step onboarding flow for new users:
1. **Profile** - Full name, company name, role, company size
2. **Campaign** - Minimal project creation (name + description only)
3. **Billing** - Optional/skippable plan selection with Lemon Squeezy integration

## Design Decisions

- **Profile storage**: New `user_profiles` table (queryable, keeps auth metadata clean)
- **Billing placement**: After campaign, optional/skippable
- **Plan display**: All 3 plans visible with "Pro" highlighted as recommended
- **Campaign scope**: Minimal (name + description) - configure rest later

---

## Phase 1: Database Schema

### Migration: `20260108000000_create_onboarding_tables.sql`

```sql
-- user_profiles table
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name text,
  company_name text,
  role text,
  company_size text CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '500+')),
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name IN ('basic', 'pro', 'unlimited')),
  display_name text NOT NULL,
  lemon_squeezy_variant_id text NOT NULL,
  price_cents integer NOT NULL,
  sessions_limit integer, -- null = unlimited
  features jsonb NOT NULL DEFAULT '[]',
  is_recommended boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  lemon_squeezy_subscription_id text UNIQUE,
  lemon_squeezy_customer_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'on_trial', 'paused')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies for all tables
-- Seed default plans (basic=free, pro=$29, unlimited=$99)
```

---

## Phase 2: Type System Updates

### Modify: `app/src/components/projects/shared/steps/types.ts`

```typescript
// Extend WizardStepId
export type WizardStepId =
  | 'project-details' | 'knowledge' | 'sessions' | 'issues'
  | 'profile' | 'campaign' | 'billing'  // NEW

// Add profile/billing form data
export interface ProfileFormData {
  fullName: string
  companyName: string
  role: string
  companySize: '1-10' | '11-50' | '51-200' | '201-500' | '500+' | ''
}

export interface BillingFormData {
  selectedPlanId: string | null
  skipped: boolean
}

// Extended form data for onboarding
export interface OnboardingFormData extends ProjectWizardFormData {
  profile: ProfileFormData
  billing: BillingFormData
}

export const DEFAULT_PROFILE_DATA: ProfileFormData = { ... }
export const DEFAULT_BILLING_DATA: BillingFormData = { ... }
```

---

## Phase 3: Step Registry Updates

### Modify: `app/src/components/projects/shared/steps/registry.ts`

```typescript
// Add imports for new steps
import { ProfileStep } from './profile-step'
import { BillingStep } from './billing-step'

// Add to STEP_REGISTRY
'profile': { id: 'profile', title: 'Profile', component: ProfileStep, validate: ... }
'billing': { id: 'billing', title: 'Choose a Plan', component: BillingStep, isOptional: true, ... }

// Update FLOW_STEP_ORDER
onboarding: ['profile', 'campaign', 'billing']
```

---

## Phase 4: New Step Components

### Create: `app/src/components/projects/shared/steps/profile-step.tsx`
- Fields: Full name (required), Company name, Role, Company size (dropdown)
- Uses FloatingCard, FormField, Input, Select from existing UI components

### Create: `app/src/components/projects/shared/steps/campaign-step.tsx`
- Simplified version of ProjectDetailsStep
- Fields: Campaign name (required), Description
- Skip knowledge, sessions, issues config

### Create: `app/src/components/projects/shared/steps/billing-step.tsx`
- Fetch plans from `/api/billing/plans`
- Display 3 plan cards (Basic/Pro/Unlimited) with Pro highlighted
- Free plan: select directly
- Paid plans: open Lemon Squeezy checkout overlay
- "Skip for now" link at bottom

---

## Phase 5: Onboarding Wizard

### Create: `app/src/components/onboarding/onboarding-wizard.tsx`
- Similar pattern to `project-wizard/index.tsx`
- Uses `getStepsForFlow('onboarding')`
- On submit:
  1. Save profile via `POST /api/user/profile`
  2. Create project via existing `createProject()`
  3. Redirect to `/projects/{id}?onboarded=true`

### Create: `app/src/app/onboarding/page.tsx` and `layout.tsx`
- Minimal layout with just logo header
- Load Lemon.js script for checkout overlay

---

## Phase 6: API Routes

### Create: `app/src/app/api/user/profile/route.ts`
- GET: Fetch current user's profile
- POST: Upsert profile with onboarding_completed flag

### Create: `app/src/app/api/billing/plans/route.ts`
- GET: Return all plans ordered by sort_order

### Create: `app/src/app/api/billing/checkout/route.ts`
- POST: Create Lemon Squeezy checkout URL with user_id in custom data
- Return URL for overlay or redirect

### Create: `app/src/app/api/webhooks/lemon-squeezy/route.ts`
- Verify signature using `LEMONSQUEEZY_WEBHOOK_SECRET`
- Handle: subscription_created, subscription_updated, subscription_cancelled
- Upsert to subscriptions table using service role

---

## Phase 7: Onboarding Detection

### Modify: `app/src/proxy.ts`

```typescript
// Add to PUBLIC_PATH_PREFIXES
'/api/webhooks/lemon-squeezy',
'/onboarding',

// After user is confirmed authenticated, before returning:
if (user && !isPublicPath(pathname) && !pathname.startsWith('/onboarding')) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (!profile || !profile.onboarding_completed) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }
}
```

---

## Phase 8: Lemon Squeezy Setup

### Install SDK
```bash
npm install @lemonsqueezy/lemonsqueezy.js
```

### Create: `app/src/lib/billing/lemon-squeezy.ts`
- `configureLemonSqueezy()` - initialize SDK with API key
- `isLemonSqueezyConfigured()` - check if configured

### Environment Variables
```
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/supabase/migrations/20260108000000_create_onboarding_tables.sql` | Database schema |
| `app/src/components/projects/shared/steps/profile-step.tsx` | Profile form step |
| `app/src/components/projects/shared/steps/campaign-step.tsx` | Simplified project step |
| `app/src/components/projects/shared/steps/billing-step.tsx` | Plan selection step |
| `app/src/components/onboarding/onboarding-wizard.tsx` | Wizard orchestrator |
| `app/src/app/onboarding/page.tsx` | Onboarding page |
| `app/src/app/onboarding/layout.tsx` | Minimal layout + Lemon.js |
| `app/src/app/api/user/profile/route.ts` | Profile API |
| `app/src/app/api/billing/plans/route.ts` | Plans API |
| `app/src/app/api/billing/checkout/route.ts` | Checkout API |
| `app/src/app/api/webhooks/lemon-squeezy/route.ts` | Webhook handler |
| `app/src/lib/billing/lemon-squeezy.ts` | SDK setup |

## Files to Modify

| File | Changes |
|------|---------|
| `app/src/components/projects/shared/steps/types.ts` | Add profile/billing types, extend WizardStepId |
| `app/src/components/projects/shared/steps/registry.ts` | Add new steps, update onboarding flow |
| `app/src/components/projects/shared/steps/index.ts` | Export new steps |
| `app/src/proxy.ts` | Add onboarding redirect logic |
| `app/package.json` | Add @lemonsqueezy/lemonsqueezy.js |

---

## Implementation Order

1. Database migration (schema + seed plans)
2. Type system updates
3. Profile step component
4. Campaign step component
5. Registry updates (profile + campaign)
6. User profile API
7. Onboarding wizard + page
8. Proxy redirect logic
9. **Test basic onboarding flow (profile → campaign)**
10. Install Lemon Squeezy SDK
11. Plans API
12. Billing step component
13. Checkout API
14. Webhook handler
15. **Test complete flow with billing**
