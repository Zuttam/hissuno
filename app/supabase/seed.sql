CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_email CONSTANT text := 'admin@hissuno.com';
  admin_password CONSTANT text := 'AdminPass123!';
  admin_user_id uuid := gen_random_uuid();
  default_instance_id CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
  existing_user_id uuid;
  identity_exists boolean;
  now_ts timestamptz := timezone('utc'::text, now());
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.instances WHERE id = default_instance_id) THEN
    INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
    VALUES (
      default_instance_id,
      default_instance_id,
      jsonb_build_object(),
      now_ts,
      now_ts
    );
  END IF;

  SELECT id INTO existing_user_id FROM auth.users WHERE email = admin_email LIMIT 1;

  IF existing_user_id IS NOT NULL THEN
    admin_user_id := existing_user_id;

    UPDATE auth.users
    SET
      encrypted_password = crypt(admin_password, gen_salt('bf', 10)),
      email_confirmed_at = now_ts,
      confirmation_token = '',
      confirmation_sent_at = now_ts,
      email_change_token_new = '',
      email_change = '',
      email_change_token_current = '',
      recovery_token = '',
      phone_change = '',
      phone_change_token = '',
      reauthentication_token = '',
      last_sign_in_at = now_ts,
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      raw_user_meta_data = jsonb_build_object(
        'email', admin_email,
        'email_verified', true,
        'phone_verified', false,
        'sub', admin_user_id::text
      ),
      updated_at = now_ts,
      instance_id = default_instance_id
    WHERE id = admin_user_id;
  ELSE
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      confirmation_sent_at,
      email_change_token_new,
      email_change,
      email_change_token_current,
      recovery_token,
      phone_change,
      phone_change_token,
      reauthentication_token,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      admin_user_id,
      default_instance_id,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf', 10)),
      now_ts,
      '',
      now_ts,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      now_ts,
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'email', admin_email,
        'email_verified', true,
        'phone_verified', false,
        'sub', admin_user_id::text
      ),
      now_ts,
      now_ts
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.identities
    WHERE user_id = admin_user_id
      AND provider = 'email'
  )
  INTO identity_exists;

  IF identity_exists THEN
    UPDATE auth.identities
    SET
      identity_data = jsonb_build_object(
        'sub', admin_user_id::text,
        'email', admin_email,
        'email_verified', true,
        'phone_verified', false
      ),
      provider_id = admin_email,
      last_sign_in_at = now_ts,
      created_at = COALESCE(created_at, now_ts),
      updated_at = now_ts
    WHERE user_id = admin_user_id
      AND provider = 'email';
  ELSE
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      admin_user_id,
      jsonb_build_object(
        'sub', admin_user_id::text,
        'email', admin_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      admin_email,
      now_ts,
      now_ts,
      now_ts
    );
  END IF;

  RAISE NOTICE 'Seed admin credentials -> email: %, password: %', admin_email, admin_password;

  -- ============================================
  -- Mark admin user as onboarded
  -- ============================================
  INSERT INTO public.user_profiles (
    user_id,
    full_name,
    company_name,
    role,
    company_size,
    onboarding_completed,
    onboarding_completed_at
  ) VALUES (
    admin_user_id,
    'Admin User',
    'Hissuno',
    'admin',
    '1-10',
    true,
    now_ts
  ) ON CONFLICT (user_id) DO UPDATE SET
    onboarding_completed = true,
    onboarding_completed_at = COALESCE(public.user_profiles.onboarding_completed_at, now_ts);

  RAISE NOTICE 'Marked admin user as onboarded';

  -- ============================================
  -- Hissuno Support Project (internal)
  -- ============================================
  -- Create an internal support project for the Hissuno app itself
  -- This allows developers using Hissuno to get support via the widget
  -- Uses a fixed UUID so the app can reference it directly
  DECLARE
    hissuno_support_project_id CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  BEGIN
    -- Check if project already exists
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = hissuno_support_project_id) THEN
      INSERT INTO public.projects (
        id,
        user_id,
        name,
        description,
        secret_key
      ) VALUES (
        hissuno_support_project_id,
        admin_user_id,
        'Hissuno Support',
        'Internal support agent for the Hissuno platform. Get help with using Hissuno features, report bugs, or request new features.',
        generate_project_key('sk_live_', 32)
      );

      -- Add project settings with all fields
      INSERT INTO public.project_settings (
        project_id,
        issue_spec_threshold,
        issue_tracking_enabled,
        widget_variant,
        widget_theme,
        widget_position,
        widget_title,
        widget_initial_message,
        session_idle_timeout_minutes,
        session_goodbye_delay_seconds,
        session_idle_response_timeout_seconds,
        allowed_origins,
        widget_token_required
      ) VALUES (
        hissuno_support_project_id,
        3,
        true,
        'sidepanel',
        'light',
        'bottom-right',
        'Support',
        'Hi! How can I help you today?',
        5,
        90,
        60,
        ARRAY['http://localhost:3000', 'https://hissuno.com', 'https://*.hissuno.com']::text[],
        false
      ) ON CONFLICT (project_id) DO UPDATE SET
        issue_spec_threshold = EXCLUDED.issue_spec_threshold,
        issue_tracking_enabled = EXCLUDED.issue_tracking_enabled,
        widget_variant = EXCLUDED.widget_variant,
        widget_theme = EXCLUDED.widget_theme,
        widget_position = EXCLUDED.widget_position,
        widget_title = EXCLUDED.widget_title,
        widget_initial_message = EXCLUDED.widget_initial_message,
        session_idle_timeout_minutes = EXCLUDED.session_idle_timeout_minutes,
        session_goodbye_delay_seconds = EXCLUDED.session_goodbye_delay_seconds,
        session_idle_response_timeout_seconds = EXCLUDED.session_idle_response_timeout_seconds,
        allowed_origins = EXCLUDED.allowed_origins,
        widget_token_required = EXCLUDED.widget_token_required;

      RAISE NOTICE 'Created Hissuno Support project with id: %', hissuno_support_project_id;
    ELSE
      RAISE NOTICE 'Hissuno Support project already exists with id: %', hissuno_support_project_id;
    END IF;

    -- ============================================
    -- Sessions (sample support conversations)
    -- ============================================
    INSERT INTO public.sessions (id, project_id, user_id, user_metadata, page_url, page_title, message_count, status, first_message_at, last_activity_at, pm_reviewed_at, tags, tags_auto_applied_at, source)
    VALUES
      ('session_mk46fypt_a6se4t9', hissuno_support_project_id, admin_user_id, '{"email": "admin@hissuno.com"}', 'http://localhost:3000/projects/00000000-0000-0000-0000-000000000001', 'Hissuno', 1, 'active', now_ts, now_ts, now_ts, '{general_feedback}', now_ts, 'widget'),
      ('session_mk46fhpt_140vx91', hissuno_support_project_id, admin_user_id, '{"email": "admin@hissuno.com"}', 'http://localhost:3000/projects/00000000-0000-0000-0000-000000000001', 'Hissuno', 3, 'active', now_ts, now_ts, now_ts, '{general_feedback,wins}', now_ts, 'widget'),
      ('session_mk46rm9s_zo3rxrw', hissuno_support_project_id, admin_user_id, '{"email": "admin@hissuno.com"}', 'http://localhost:3000/projects/00000000-0000-0000-0000-000000000001', 'Hissuno', 3, 'active', now_ts, now_ts, now_ts, '{bug,losses}', now_ts, 'widget'),
      ('session_mk46zyb6_m3rk11i', hissuno_support_project_id, admin_user_id, '{"email": "admin@hissuno.com"}', 'http://localhost:3000/projects/00000000-0000-0000-0000-000000000001', 'Hissuno', 2, 'active', now_ts, now_ts, now_ts, '{feature_request,wins}', now_ts, 'widget'),
      ('session_mk476qlx_cdd3xux', hissuno_support_project_id, admin_user_id, '{"email": "admin@hissuno.com"}', 'http://localhost:3000/projects/00000000-0000-0000-0000-000000000001', 'Hissuno', 3, 'closed', now_ts, now_ts, now_ts, '{general_feedback}', now_ts, 'widget')
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Seeded 5 sessions';

    -- ============================================
    -- Session Messages (sample conversations)
    -- ============================================
    -- Session 1: general_feedback (1 message)
    INSERT INTO public.session_messages (session_id, project_id, sender_type, content, created_at)
    VALUES
      ('session_mk46fypt_a6se4t9', hissuno_support_project_id, 'user', 'Hi! I just signed up and I''m trying to understand how to get started with Hissuno. Where should I begin?', now_ts)
    ON CONFLICT DO NOTHING;

    -- Session 2: general_feedback, wins (3 messages)
    INSERT INTO public.session_messages (session_id, project_id, sender_type, content, created_at)
    VALUES
      ('session_mk46fhpt_140vx91', hissuno_support_project_id, 'user', 'Hey, just wanted to say thanks for the help yesterday! Got everything working now.', now_ts - interval '2 minutes'),
      ('session_mk46fhpt_140vx91', hissuno_support_project_id, 'ai', 'That''s wonderful to hear! I''m glad everything is working smoothly now. Is there anything else you''d like help with today?', now_ts - interval '1 minute'),
      ('session_mk46fhpt_140vx91', hissuno_support_project_id, 'user', 'Nope, all good! The product is really intuitive once you get the hang of it. Great work!', now_ts)
    ON CONFLICT DO NOTHING;

    -- Session 3: bug, losses (3 messages - linked to CSV export bug)
    INSERT INTO public.session_messages (session_id, project_id, sender_type, content, created_at)
    VALUES
      ('session_mk46rm9s_zo3rxrw', hissuno_support_project_id, 'user', 'I''m trying to export my data to CSV but it keeps timing out. I have about 500 rows and after waiting for a minute it just shows a 504 error. Using Chrome on macOS.', now_ts - interval '5 minutes'),
      ('session_mk46rm9s_zo3rxrw', hissuno_support_project_id, 'ai', 'I''m sorry to hear you''re experiencing issues with the CSV export. A 504 Gateway Timeout on a 500-row export shouldn''t happen. Let me help troubleshoot this. Have you tried clearing your browser cache or using an incognito window?', now_ts - interval '4 minutes'),
      ('session_mk46rm9s_zo3rxrw', hissuno_support_project_id, 'user', 'Yes, I tried incognito mode and it still doesn''t work. Same 504 error. This is really frustrating because I have a client deliverable due tomorrow and I need this data exported.', now_ts - interval '3 minutes')
    ON CONFLICT DO NOTHING;

    -- Session 4: feature_request, wins (2 messages - linked to dark mode feature)
    INSERT INTO public.session_messages (session_id, project_id, sender_type, content, created_at)
    VALUES
      ('session_mk46zyb6_m3rk11i', hissuno_support_project_id, 'user', 'Would it be possible to add dark mode support for the chat widget? Many of our users prefer dark themes and it would be great if the widget could auto-detect system preferences using prefers-color-scheme.', now_ts - interval '10 minutes'),
      ('session_mk46zyb6_m3rk11i', hissuno_support_project_id, 'ai', 'That''s a great suggestion! Dark mode support with automatic system preference detection would definitely improve the user experience. I''ve noted this as a feature request and will pass it along to our product team. In the meantime, if you''re using React, you could potentially apply custom CSS overrides to adjust the widget styling.', now_ts - interval '9 minutes')
    ON CONFLICT DO NOTHING;

    -- Session 5: general_feedback, closed (3 messages - resolved conversation)
    INSERT INTO public.session_messages (session_id, project_id, sender_type, content, created_at)
    VALUES
      ('session_mk476qlx_cdd3xux', hissuno_support_project_id, 'user', 'How do I configure the widget to only show on certain pages of my site?', now_ts - interval '1 hour'),
      ('session_mk476qlx_cdd3xux', hissuno_support_project_id, 'ai', 'You can control where the widget appears by configuring the allowed_origins in your project settings, or by conditionally loading the widget script based on the current URL in your application code. For single-page apps, you can mount/unmount the widget component based on route matching.', now_ts - interval '59 minutes'),
      ('session_mk476qlx_cdd3xux', hissuno_support_project_id, 'user', 'Perfect, that makes sense! I''ll set it up with conditional loading. Thanks for the quick response!', now_ts - interval '58 minutes')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Seeded session messages for all 5 sessions';

    -- ============================================
    -- Issues (sample bugs and feature requests)
    -- ============================================
    DECLARE
      bug_issue_id CONSTANT uuid := '23879a5e-c033-4298-b475-17acc65d9db7';
      feature_issue_id CONSTANT uuid := 'a505054d-596e-4705-b473-8ecc65fc88ae';
    BEGIN
      INSERT INTO public.issues (id, project_id, type, title, description, priority, priority_manual_override, upvote_count, status)
      VALUES
        (bug_issue_id, hissuno_support_project_id, 'bug', 'CSV Export Fails with 504 Timeout on Chrome macOS',
         '**Problem**: CSV export (~500 rows) hangs and returns a 504 error; download never starts.

**Details**: Occurs on Chrome macOS, even in incognito mode. Network tab shows 504 Gateway Timeout.

**Impact**: User is blocked on a client deliverable with no reliable workaround.

**Priority**: High (P1) due to user being blocked.',
         'high', false, 1, 'open'),
        (feature_issue_id, hissuno_support_project_id, 'feature_request', 'Add Dark Mode Support for Chat Widget with Auto-Detection',
         'The user requests a dark mode feature for the chat widget, with auto-detection of system preferences using `prefers-color-scheme`. This feature is important as it impacts approximately 40% of users who prefer dark themes. A temporary CSS-based workaround is suggested for React users.',
         'high', false, 1, 'open')
      ON CONFLICT (id) DO NOTHING;

      -- Link issues to sessions
      INSERT INTO public.issue_sessions (issue_id, session_id)
      VALUES
        (feature_issue_id, 'session_mk46zyb6_m3rk11i'),
        (bug_issue_id, 'session_mk46rm9s_zo3rxrw')
      ON CONFLICT (issue_id, session_id) DO NOTHING;

      RAISE NOTICE 'Seeded 2 issues with session links';
    END;
  END;
END
$$;
