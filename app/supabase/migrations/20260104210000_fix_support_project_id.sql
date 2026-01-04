-- Fix the internal Hissuno Support project to use a fixed UUID
-- This migration ensures the project exists with the known ID

DO $$
DECLARE
  hissuno_support_project_id CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  admin_user_id uuid;
BEGIN
  -- Get the admin user ID (first user in the system)
  SELECT id INTO admin_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    RAISE NOTICE 'No admin user found, skipping support project creation';
    RETURN;
  END IF;

  -- Check if the project already exists with the fixed ID
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = hissuno_support_project_id) THEN
    -- Check if there's an old support project with a different ID (identified by name)
    DECLARE
      old_project_id uuid;
    BEGIN
      SELECT id INTO old_project_id
      FROM public.projects
      WHERE name = 'Hissuno Support'
      LIMIT 1;

      IF old_project_id IS NOT NULL THEN
        -- Update the old project to use the new fixed ID
        UPDATE public.projects
        SET id = hissuno_support_project_id
        WHERE id = old_project_id;

        RAISE NOTICE 'Updated Hissuno Support project from % to %', old_project_id, hissuno_support_project_id;
      ELSE
        -- Create the project fresh
        INSERT INTO public.projects (
          id,
          user_id,
          name,
          description,
          secret_key,
          allowed_origins
        ) VALUES (
          hissuno_support_project_id,
          admin_user_id,
          'Hissuno Support',
          'Internal support agent for the Hissuno platform.',
          'sk_live_' || encode(gen_random_bytes(24), 'base64'),
          ARRAY['http://localhost:3000', 'https://hissuno.com', 'https://*.hissuno.com']::text[]
        );

        RAISE NOTICE 'Created Hissuno Support project with id: %', hissuno_support_project_id;
      END IF;
    END;
  ELSE
    RAISE NOTICE 'Hissuno Support project already exists with correct id: %', hissuno_support_project_id;
  END IF;
END $$;
