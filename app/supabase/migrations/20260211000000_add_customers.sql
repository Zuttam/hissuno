-- Add companies, contacts, and custom field definitions tables
-- for the Customers feature (CRM baseline for impact analysis)

-- ============================================================================
-- Companies
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text NOT NULL,
  arr numeric,
  stage text DEFAULT 'prospect' CHECK (stage IN ('prospect', 'onboarding', 'active', 'churned', 'expansion')),
  product_used text,
  industry text,
  employee_count integer,
  plan_tier text,
  renewal_date date,
  health_score numeric CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100)),
  country text,
  notes text,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  is_archived boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.companies OWNER TO postgres;

-- Domain must be unique per project
CREATE UNIQUE INDEX IF NOT EXISTS companies_project_domain_unique ON public.companies(project_id, domain);

COMMENT ON TABLE public.companies IS 'Companies (accounts) associated with a project for CRM and impact analysis.';
COMMENT ON COLUMN public.companies.domain IS 'Company domain (unique per project, e.g. acme.com).';
COMMENT ON COLUMN public.companies.arr IS 'Annual recurring revenue in USD.';
COMMENT ON COLUMN public.companies.stage IS 'Customer lifecycle stage: prospect, onboarding, active, churned, or expansion.';
COMMENT ON COLUMN public.companies.health_score IS 'Customer health indicator from 0 to 100.';
COMMENT ON COLUMN public.companies.custom_fields IS 'User-defined custom field values as JSONB.';

-- Indexes for companies
CREATE INDEX IF NOT EXISTS companies_project_id_idx ON public.companies(project_id);
CREATE INDEX IF NOT EXISTS companies_stage_idx ON public.companies(stage);
CREATE INDEX IF NOT EXISTS companies_is_archived_idx ON public.companies(is_archived);
CREATE INDEX IF NOT EXISTS companies_created_at_idx ON public.companies(created_at DESC);

-- Trigger for companies updated_at
CREATE TRIGGER handle_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- ============================================================================
-- Contacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text,
  title text,
  phone text,
  company_url text,
  is_champion boolean DEFAULT false,
  last_contacted_at timestamptz,
  notes text,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  is_archived boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.contacts OWNER TO postgres;

-- Email must be unique per project
CREATE UNIQUE INDEX IF NOT EXISTS contacts_project_email_unique ON public.contacts(project_id, email);

COMMENT ON TABLE public.contacts IS 'Contacts (people) associated with companies for CRM tracking.';
COMMENT ON COLUMN public.contacts.email IS 'Contact email (unique per project).';
COMMENT ON COLUMN public.contacts.is_champion IS 'Whether this contact is an internal champion/advocate.';
COMMENT ON COLUMN public.contacts.custom_fields IS 'User-defined custom field values as JSONB.';

-- Indexes for contacts
CREATE INDEX IF NOT EXISTS contacts_project_id_idx ON public.contacts(project_id);
CREATE INDEX IF NOT EXISTS contacts_company_id_idx ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS contacts_is_champion_idx ON public.contacts(is_champion);
CREATE INDEX IF NOT EXISTS contacts_is_archived_idx ON public.contacts(is_archived);
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON public.contacts(created_at DESC);

-- Trigger for contacts updated_at
CREATE TRIGGER handle_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- ============================================================================
-- Customer Custom Field Definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('company', 'contact')),
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
  select_options text[],
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0 AND position <= 9),
  is_required boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.customer_custom_field_definitions OWNER TO postgres;

-- Field key must be unique per project + entity type
CREATE UNIQUE INDEX IF NOT EXISTS custom_field_defs_project_entity_key_unique
  ON public.customer_custom_field_definitions(project_id, entity_type, field_key);

COMMENT ON TABLE public.customer_custom_field_definitions IS 'User-defined custom field definitions for companies and contacts. Max 10 per entity type per project.';
COMMENT ON COLUMN public.customer_custom_field_definitions.entity_type IS 'Whether this field applies to companies or contacts.';
COMMENT ON COLUMN public.customer_custom_field_definitions.field_key IS 'Slug-style key used in custom_fields JSONB column.';
COMMENT ON COLUMN public.customer_custom_field_definitions.field_type IS 'Data type: text, number, date, boolean, or select.';
COMMENT ON COLUMN public.customer_custom_field_definitions.select_options IS 'Available options when field_type is select.';
COMMENT ON COLUMN public.customer_custom_field_definitions.position IS 'Display order (0-9, max 10 fields per entity type).';

-- Indexes for custom field definitions
CREATE INDEX IF NOT EXISTS custom_field_defs_project_entity_idx
  ON public.customer_custom_field_definitions(project_id, entity_type);

-- Trigger for custom field definitions updated_at
CREATE TRIGGER handle_custom_field_defs_updated_at
  BEFORE UPDATE ON public.customer_custom_field_definitions
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- ============================================================================
-- Row Level Security - Companies
-- ============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view companies for their projects" ON public.companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert companies for their projects" ON public.companies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update companies for their projects" ON public.companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete companies for their projects" ON public.companies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage companies" ON public.companies
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Row Level Security - Contacts
-- ============================================================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contacts for their projects" ON public.contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contacts for their projects" ON public.contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contacts for their projects" ON public.contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contacts for their projects" ON public.contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage contacts" ON public.contacts
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Row Level Security - Custom Field Definitions
-- ============================================================================

ALTER TABLE public.customer_custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view custom field definitions for their projects" ON public.customer_custom_field_definitions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert custom field definitions for their projects" ON public.customer_custom_field_definitions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update custom field definitions for their projects" ON public.customer_custom_field_definitions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete custom field definitions for their projects" ON public.customer_custom_field_definitions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage custom field definitions" ON public.customer_custom_field_definitions
  FOR ALL USING (auth.role() = 'service_role');
