-- ===========================================================================
-- MiniLedger - user display names
--
-- Safe to run on existing databases:
--  * `ADD COLUMN IF NOT EXISTS` never drops or rewrites the users table.
--  * Existing rows keep a NULL name until the next successful sign-in, which
--    stores the name submitted with the OTP request. The API treats a missing
--    name as "unknown" instead of failing.
-- ===========================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(80);

-- The sign-in form collects the name together with the phone number. The name
-- travels on the OTP challenge so that verification stays a single
-- phone + code request, and the name that was submitted with the code that was
-- actually used is the one that gets stored.
ALTER TABLE otp_challenges ADD COLUMN IF NOT EXISTS requested_name VARCHAR(80);
