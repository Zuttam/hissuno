-- Replace single creation_policy_enabled flag with a full config jsonb
-- that carries per-strategy matching knobs and split creation policies.

ALTER TABLE "graph_evaluation_settings"
  ADD COLUMN "config" jsonb NOT NULL DEFAULT jsonb_build_object(
    'strategies', jsonb_build_object(
      'session',     jsonb_build_object('enabled', true, 'threshold', 0.6),
      'issue',       jsonb_build_object('enabled', true, 'threshold', 0.6),
      'knowledge',   jsonb_build_object('enabled', true, 'threshold', 0.6),
      'contact',     jsonb_build_object('enabled', true, 'threshold', 0.6),
      'company',     jsonb_build_object(
        'semanticEnabled',        true,
        'semanticThreshold',      0.6,
        'textMatchEnabled',       true,
        'textMatchMinNameLength', 3
      ),
      'productScope', jsonb_build_object(
        'enabled',               true,
        'requireFullTopicMatch', false,
        'llmClassification',     true
      )
    ),
    'creation', jsonb_build_object(
      'contacts', jsonb_build_object('enabled', true),
      'issues',   jsonb_build_object(
        'enabled',             true,
        'linkThreshold',       0.65,
        'safetyNetThreshold',  0.55,
        'actionableTags',      jsonb_build_array('bug','feature_request','change_request')
      )
    )
  );
--> statement-breakpoint
-- Backfill existing rows: preserve prior creation_policy_enabled for both contacts + issues.
UPDATE "graph_evaluation_settings"
  SET "config" = jsonb_set(
    jsonb_set(
      "config",
      '{creation,contacts,enabled}',
      to_jsonb("creation_policy_enabled")
    ),
    '{creation,issues,enabled}',
    to_jsonb("creation_policy_enabled")
  );
--> statement-breakpoint
ALTER TABLE "graph_evaluation_settings" DROP COLUMN "creation_policy_enabled";
