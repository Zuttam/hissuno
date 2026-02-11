-- Fix RLS policies: add TO authenticated and WITH CHECK on UPDATE policies
-- Without TO authenticated, policies default to PUBLIC which includes anon role

-- ============================================================================
-- Companies RLS Fixes
-- ============================================================================

DROP POLICY IF EXISTS "Users can view companies for their projects" ON public.companies;
DROP POLICY IF EXISTS "Users can insert companies for their projects" ON public.companies;
DROP POLICY IF EXISTS "Users can update companies for their projects" ON public.companies;
DROP POLICY IF EXISTS "Users can delete companies for their projects" ON public.companies;

CREATE POLICY "Users can view companies for their projects" ON public.companies
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert companies for their projects" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update companies for their projects" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete companies for their projects" ON public.companies
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = companies.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Contacts RLS Fixes
-- ============================================================================

DROP POLICY IF EXISTS "Users can view contacts for their projects" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts for their projects" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts for their projects" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts for their projects" ON public.contacts;

CREATE POLICY "Users can view contacts for their projects" ON public.contacts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contacts for their projects" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contacts for their projects" ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contacts for their projects" ON public.contacts
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = contacts.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Custom Field Definitions RLS Fixes
-- ============================================================================

DROP POLICY IF EXISTS "Users can view custom field definitions for their projects" ON public.customer_custom_field_definitions;
DROP POLICY IF EXISTS "Users can insert custom field definitions for their projects" ON public.customer_custom_field_definitions;
DROP POLICY IF EXISTS "Users can update custom field definitions for their projects" ON public.customer_custom_field_definitions;
DROP POLICY IF EXISTS "Users can delete custom field definitions for their projects" ON public.customer_custom_field_definitions;

CREATE POLICY "Users can view custom field definitions for their projects" ON public.customer_custom_field_definitions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert custom field definitions for their projects" ON public.customer_custom_field_definitions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update custom field definitions for their projects" ON public.customer_custom_field_definitions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete custom field definitions for their projects" ON public.customer_custom_field_definitions
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = customer_custom_field_definitions.project_id
      AND projects.user_id = auth.uid()
    )
  );
