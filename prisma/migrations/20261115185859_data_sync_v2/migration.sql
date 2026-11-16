-- History sync v2
--
-- 1. user_sync_state: a per-user revision counter.
-- 2. user_sync_data.revision: per-user monotonic change number (the sync cursor), assigned by a
--    trigger on every insert/update so no write path can forget it.
-- 3. user_sync_data.clientUpdatedAt: client edit time, used for last-write-wins conflict resolution.
-- 4. Unique key becomes (userId, hashedKey). The previous (userId, hashedKey, orgId) index treated
--    NULL orgId values as distinct, so it did not prevent duplicates. It is kept for now so API
--    instances still running the previous build keep working during a rolling deploy.

-- Block writers for the duration: a row inserted between the backfill and the trigger being created
-- would be left at revision 0. The table is small, so this is held for a moment only.
LOCK TABLE "user_sync_data" IN SHARE ROW EXCLUSIVE MODE;

-- CreateTable
CREATE TABLE "user_sync_state" (
    "userId" UUID NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "user_sync_state_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_sync_state" ADD CONSTRAINT "user_sync_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "user_sync_data"
  ADD COLUMN "revision" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "clientUpdatedAt" TIMESTAMP(3);

-- Remove duplicates of (userId, hashedKey), keeping the most recently written row
DELETE FROM "user_sync_data"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT "id", row_number() OVER (PARTITION BY "userId", "hashedKey" ORDER BY "updatedAt" DESC, "id" DESC) AS "rowNumber"
    FROM "user_sync_data"
  ) AS "ranked"
  WHERE "rowNumber" > 1
);

-- `data` is client-supplied JSON, so a value that looks like a timestamp may still not be one
-- (e.g. month 13). A failed cast must fall through to the next source, not abort the migration.
CREATE FUNCTION pg_temp.sync_data_timestamp(value text) RETURNS timestamp AS $$
BEGIN
  IF value IS NULL OR value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' THEN
    RETURN NULL;
  END IF;
  RETURN value::timestamptz AT TIME ZONE 'UTC';
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Backfill the client edit time from the record itself. The updatedAt COLUMN is the server write time
-- and is only the fallback (and the upper bound, for records written by a client whose clock ran ahead).
UPDATE "user_sync_data"
SET "clientUpdatedAt" = LEAST(
  COALESCE(pg_temp.sync_data_timestamp("data"->>'updatedAt'), pg_temp.sync_data_timestamp("data"->>'lastRun'), "updatedAt"),
  "updatedAt"
)
WHERE "deletedAt" IS NULL;

-- Deleted records only need to exist as markers: drop their payload
UPDATE "user_sync_data"
SET "data" = '{}'::jsonb,
    "clientUpdatedAt" = "deletedAt"
WHERE "deletedAt" IS NOT NULL;

-- Number each user's existing rows in the order they were last written
UPDATE "user_sync_data" AS "target"
SET "revision" = "ranked"."rowNumber"
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "userId" ORDER BY "updatedAt", "key", "id") AS "rowNumber"
  FROM "user_sync_data"
) AS "ranked"
WHERE "target"."id" = "ranked"."id";

INSERT INTO "user_sync_state" ("userId", "revision")
SELECT "userId", max("revision")
FROM "user_sync_data"
GROUP BY "userId";

-- CreateIndex
CREATE UNIQUE INDEX "user_sync_data_user_hashed_key" ON "user_sync_data"("userId", "hashedKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_sync_data_user_revision" ON "user_sync_data"("userId", "revision");

-- Assign the next revision of the owning user to every inserted or updated row. The counter row is
-- locked until the writing transaction commits, which serializes each user's writers: revisions become
-- visible in the order they were assigned, so a reader that has seen revision N can never later
-- discover a row at or below N. Created after the backfill above so it does not renumber those rows.
--
-- NOTE: this fires on EVERY update, so any future bulk UPDATE of this table gives each touched row a
-- new revision and makes every client pull those rows again. Disable the trigger for such a backfill
-- unless that is what you want.
CREATE FUNCTION user_sync_data_assign_revision() RETURNS trigger AS $$
BEGIN
  INSERT INTO "user_sync_state" ("userId", "revision")
  VALUES (NEW."userId", 1)
  ON CONFLICT ("userId") DO UPDATE SET "revision" = "user_sync_state"."revision" + 1
  RETURNING "revision" INTO NEW."revision";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_sync_data_assign_revision
BEFORE INSERT OR UPDATE ON "user_sync_data"
FOR EACH ROW EXECUTE FUNCTION user_sync_data_assign_revision();
