-- Migration: Add widget trigger, display, shortcut, and drawer badge label columns
-- This migration separates the widget variant concept into separate trigger and display types

-- Step 1: Drop existing CHECK constraint for widget_variant
ALTER TABLE public.project_settings
  DROP CONSTRAINT IF EXISTS widget_variant_check;

-- Step 2: Add new columns for trigger/display separation
ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS widget_trigger_type text DEFAULT 'bubble',
  ADD COLUMN IF NOT EXISTS widget_display_type text DEFAULT 'sidepanel',
  ADD COLUMN IF NOT EXISTS widget_shortcut text DEFAULT 'mod+k',
  ADD COLUMN IF NOT EXISTS widget_drawer_badge_label text DEFAULT 'Support';

-- Step 3: Add CHECK constraints for new columns
ALTER TABLE public.project_settings
  ADD CONSTRAINT widget_trigger_type_check CHECK (widget_trigger_type IN ('bubble', 'drawer-badge', 'headless')),
  ADD CONSTRAINT widget_display_type_check CHECK (widget_display_type IN ('popup', 'sidepanel', 'dialog'));

-- Step 4: Migrate existing data from widget_variant to widget_display_type
-- The widget_variant column maps directly to widget_display_type (popup or sidepanel)
UPDATE public.project_settings
SET widget_display_type = COALESCE(widget_variant, 'sidepanel')
WHERE widget_display_type = 'sidepanel' AND widget_variant IS NOT NULL;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN public.project_settings.widget_trigger_type IS 'Type of trigger element: bubble (floating button), drawer-badge (side tab), or headless (keyboard-only)';
COMMENT ON COLUMN public.project_settings.widget_display_type IS 'How the chat UI appears: popup (corner modal), sidepanel (full-height drawer), or dialog (centered modal)';
COMMENT ON COLUMN public.project_settings.widget_shortcut IS 'Keyboard shortcut to toggle widget, e.g., mod+k (cmd/ctrl+k). Set to empty string to disable.';
COMMENT ON COLUMN public.project_settings.widget_drawer_badge_label IS 'Label text displayed on the drawer badge trigger';

-- Note: We keep widget_variant for backwards compatibility during migration period
-- It can be removed in a future migration once all code has been updated
