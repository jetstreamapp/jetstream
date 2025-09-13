-- AlterTable
ALTER TABLE "User"
ADD COLUMN "hasPasswordSet" boolean GENERATED ALWAYS AS (
  password IS NOT NULL
) STORED;

-- Update session table to include userId and add indexes
-- Convert to jsonb (indexable, compact).
ALTER TABLE sessions
  ALTER COLUMN sess TYPE jsonb USING sess::jsonb;

-- Add generated column for the user id inside sess.user.id
ALTER TABLE sessions
  ADD COLUMN user_id uuid GENERATED ALWAYS AS ((sess->'user'->>'id')::uuid) STORED;

-- Composite index for query pattern (filter users, order by newest)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_created_at_sid
  ON sessions (user_id, "createdAt" DESC, sid DESC);

