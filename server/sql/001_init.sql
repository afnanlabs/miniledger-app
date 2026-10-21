-- ===========================================================================
-- MiniLedger - initial schema
--
-- The statements below are idempotent: running them repeatedly never destroys
-- existing data. Use `npm run db:migrate` to apply them.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  VARCHAR(20) NOT NULL UNIQUE,
  -- Display name collected at sign-in. Nullable so accounts created before
  -- names existed stay valid; migration 002 backfills nothing on purpose.
  name          VARCHAR(80),
  -- Bumped on logout. Tokens issued before the bump are rejected.
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- otp_challenges (mock OTP - no SMS provider is used)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users (id) ON DELETE CASCADE,
  phone_number  VARCHAR(20) NOT NULL,
  -- Name submitted with this OTP request; applied when the code is verified.
  requested_name VARCHAR(80),
  -- bcrypt hash of the six digit code - the plain code is never stored.
  code_hash     TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 5,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_challenges_phone_created_idx
  ON otp_challenges (phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS otp_challenges_active_idx
  ON otp_challenges (phone_number)
  WHERE consumed_at IS NULL;

-- ---------------------------------------------------------------------------
-- loans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_name  VARCHAR(80) NOT NULL,
  -- NUMERIC keeps money exact - no floating point storage.
  amount       NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  -- Calendar date, no time and no timezone.
  due_date     DATE NOT NULL,
  status       VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'repaid')),
  repaid_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A repaid loan always carries a repayment timestamp and vice versa.
  CONSTRAINT loans_repaid_at_matches_status
    CHECK ((status = 'repaid') = (repaid_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS loans_user_id_idx ON loans (user_id);
CREATE INDEX IF NOT EXISTS loans_user_status_idx ON loans (user_id, status);
CREATE INDEX IF NOT EXISTS loans_user_due_date_idx ON loans (user_id, due_date);

-- ---------------------------------------------------------------------------
-- Keep `updated_at` fresh automatically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS loans_set_updated_at ON loans;
CREATE TRIGGER loans_set_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
