-- Add widget settings columns to project_settings table
ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS widget_variant text DEFAULT 'popup',
  ADD COLUMN IF NOT EXISTS widget_theme text DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS widget_position text DEFAULT 'bottom-right',
  ADD COLUMN IF NOT EXISTS widget_title text DEFAULT 'Support',
  ADD COLUMN IF NOT EXISTS widget_initial_message text DEFAULT 'Hi! How can I help you today?';

-- Add constraints for valid enum values
ALTER TABLE project_settings
  ADD CONSTRAINT widget_variant_check CHECK (widget_variant IN ('popup', 'sidepanel')),
  ADD CONSTRAINT widget_theme_check CHECK (widget_theme IN ('light', 'dark', 'auto')),
  ADD CONSTRAINT widget_position_check CHECK (widget_position IN ('bottom-right', 'bottom-left', 'top-right', 'top-left'));
