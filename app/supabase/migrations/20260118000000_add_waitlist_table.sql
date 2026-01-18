-- Create waitlist table for collecting emails
CREATE TABLE waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  ip_address text,  -- For rate limiting analysis
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Rate limiting function: max 5 inserts per IP per hour
CREATE OR REPLACE FUNCTION check_waitlist_rate_limit(client_ip text)
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) < 5
    FROM waitlist
    WHERE ip_address = client_ip
    AND created_at > now() - interval '1 hour'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow inserts from anyone (anon key) with rate limiting
CREATE POLICY "Rate-limited waitlist inserts" ON waitlist
  FOR INSERT WITH CHECK (
    check_waitlist_rate_limit(current_setting('request.headers', true)::json->>'x-forwarded-for')
  );
