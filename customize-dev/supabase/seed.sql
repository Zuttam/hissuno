CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_email CONSTANT text := 'admin@customize.dev';
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
END
$$;
