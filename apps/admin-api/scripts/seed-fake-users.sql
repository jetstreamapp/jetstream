-- Seeds fake users and teams into a LOCAL database so the admin app's lists, filters and pagination can be
-- tried at volume. Every seeded row is tagged (user ids `seed|…`, emails on `.test` domains, team names
-- starting with `[seed]`) and previous seed rows are deleted first, so the script is safe to re-run.
--
--   psql "$JETSTREAM_POSTGRES_DBURI" -f apps/admin-api/scripts/seed-fake-users.sql
--   psql "$JETSTREAM_POSTGRES_DBURI" -v user_count=20000 -v team_count=200 -f apps/admin-api/scripts/seed-fake-users.sql
--   psql "$JETSTREAM_POSTGRES_DBURI" -v cleanup_only=1 -f apps/admin-api/scripts/seed-fake-users.sql
--
-- What you get, roughly: 1 in 7 users on a team (first member ADMIN, every 10th BILLING, some INACTIVE),
-- 1 in 11 with a personal subscription (some of them also on a team), 15% who never logged in, a few locked
-- or unverified. Teams mix ACTIVE / MANUAL / PAST_DUE billing, some are INACTIVE, and every 4th has a
-- PENDING domain to approve. Fake Stripe ids (cus_seed…, sub_seed…) do not exist in Stripe.

\set ON_ERROR_STOP on

\if :{?user_count}
\else
  \set user_count 5000
\endif
\if :{?team_count}
\else
  \set team_count 60
\endif
\if :{?cleanup_only}
\else
  \set cleanup_only 0
\endif
\if :{?force}
\else
  \set force 0
\endif

-- A database with many real users is not a local one
SELECT count(*) > 1000 AS looks_like_production FROM "User" WHERE "userId" NOT LIKE 'seed|%' \gset
\if :looks_like_production
  \if :force
  \else
    \echo 'Refusing to run: this database has more than 1000 non-seed users. Pass -v force=1 if it really is a local copy.'
    \quit
  \endif
\endif

BEGIN;

-- Login activity and audit logs outlive the users and teams they mention, so they are cleared explicitly
DELETE FROM "LoginActivity" WHERE "userId" IN (SELECT id FROM "User" WHERE "userId" LIKE 'seed|%');
DELETE FROM audit_log
WHERE "userId" IN (SELECT id FROM "User" WHERE "userId" LIKE 'seed|%')
  OR "teamId" IN (SELECT id FROM team WHERE name LIKE '[seed] %')
  OR "resourceId" IN (SELECT id::text FROM team WHERE name LIKE '[seed] %');
-- Deleting a login configuration cascades to its team and everything the team owns
DELETE FROM login_configuration WHERE id IN (SELECT "loginConfigId" FROM team WHERE name LIKE '[seed] %');
-- Cascades to billing accounts, subscriptions, entitlements and memberships
DELETE FROM "User" WHERE "userId" LIKE 'seed|%';

\if :cleanup_only
  COMMIT;
  \echo 'Seed rows removed'
  \quit
\endif

CREATE TEMP TABLE seed_user ON COMMIT DROP AS
SELECT
  user_number,
  uuid_generate_v4() AS id,
  first_name,
  last_name,
  company,
  created_at,
  -- 15% never logged in
  CASE WHEN random() < 0.15 THEN NULL ELSE created_at + random() * (now() - created_at) END AS last_logged_in
FROM (
  SELECT
    user_number,
    (ARRAY['Ada','Grace','Alan','Katherine','Linus','Margaret','Dennis','Barbara','Ken','Radia','Tim','Frances','John','Hedy','Guido','Anita','Bjarne','Shafi','Edsger','Lynn'])[1 + user_number % 20] AS first_name,
    (ARRAY['Lovelace','Hopper','Turing','Johnson','Torvalds','Hamilton','Ritchie','Liskov','Thompson','Perlman','Berners-Lee','Allen','McCarthy','Lamarr','Rossum','Borg','Stroustrup','Goldwasser','Dijkstra','Conway'])[1 + (user_number / 20) % 20] AS last_name,
    (ARRAY['acme','globex','initech','umbrella','hooli','stark','wayne','wonka','tyrell','cyberdyne','soylent','vandelay','massive','oscorp','aperture'])[1 + user_number % 15] AS company,
    now() - random() * interval '1100 days' AS created_at
  FROM generate_series(1, :user_count) AS user_number
) AS generated;

INSERT INTO "User" (id, "userId", email, name, "emailVerified", "createdAt", "updatedAt", "lastLoggedIn", "lockedUntil", "failedLoginAttempts")
SELECT
  id,
  'seed|' || lpad(user_number::text, 7, '0'),
  lower(first_name || '.' || replace(last_name, '-', '') || '.' || user_number) || '@' || company || '.test',
  first_name || ' ' || last_name,
  user_number % 13 <> 0,
  created_at,
  coalesce(last_logged_in, created_at),
  last_logged_in,
  CASE WHEN user_number % 97 = 0 THEN now() + interval '1 hour' END,
  CASE WHEN user_number % 97 = 0 THEN 5 ELSE 0 END
FROM seed_user;

-- One successful login per user so the dashboard's active-user counts have something to count
INSERT INTO "LoginActivity" (action, method, email, "userId", success, "createdAt")
SELECT 'LOGIN', 'credentials', u.email, u.id, true, u."lastLoggedIn"
FROM "User" u
WHERE u."userId" LIKE 'seed|%' AND u."lastLoggedIn" IS NOT NULL;

-- Personal (Professional) subscriptions
INSERT INTO billing_account ("userId", "customerId", "createdAt", "updatedAt")
SELECT id, 'cus_seed_u' || user_number, created_at, created_at
FROM seed_user
WHERE user_number % 11 = 0;

INSERT INTO subscription ("userId", "customerId", "subscriptionId", "priceId", status, "createdAt", "updatedAt")
SELECT
  id,
  'cus_seed_u' || user_number,
  'sub_seed_u' || user_number,
  'price_seed_professional',
  CASE WHEN user_number % 10 = 1 THEN 'TRIALING' WHEN user_number % 10 = 2 THEN 'INCOMPLETE' ELSE 'ACTIVE' END,
  created_at,
  created_at
FROM seed_user
WHERE user_number % 11 = 0;

INSERT INTO entitlement ("userId", "chromeExtension", "googleDrive", "recordSync", desktop, "analysisTools", "updatedAt")
SELECT id, paid, paid, paid, paid, paid, now()
FROM (SELECT id, user_number % 11 = 0 AS paid FROM seed_user) AS entitlement_source;

-- Teams
CREATE TEMP TABLE seed_team ON COMMIT DROP AS
SELECT
  team_number,
  uuid_generate_v4() AS id,
  uuid_generate_v4() AS login_config_id,
  '[seed] ' || (ARRAY['Acme','Globex','Initech','Umbrella','Hooli','Stark','Wayne','Wonka','Tyrell','Cyberdyne'])[1 + team_number % 10] || ' ' || lpad(team_number::text, 3, '0') AS name,
  CASE WHEN team_number % 20 = 0 THEN 'INACTIVE' ELSE 'ACTIVE' END AS status,
  CASE WHEN team_number % 9 = 0 THEN 'PAST_DUE' WHEN team_number % 5 = 0 THEN 'MANUAL' ELSE 'ACTIVE' END AS billing_status,
  now() - random() * interval '700 days' AS created_at
FROM generate_series(1, :team_count) AS team_number;

INSERT INTO login_configuration (id, "createdAt", "updatedAt")
SELECT login_config_id, created_at, created_at FROM seed_team;

INSERT INTO team (id, name, "loginConfigId", status, "billingStatus", "createdAt", "updatedAt")
SELECT id, name, login_config_id, status, billing_status, created_at, created_at FROM seed_team;

INSERT INTO team_entitlement ("teamId", "chromeExtension", "googleDrive", "recordSync", desktop, "analysisTools", "updatedAt")
SELECT id, true, true, true, true, true, now() FROM seed_team;

INSERT INTO team_member ("teamId", "userId", role, status, "createdAt", "updatedAt")
SELECT
  team_id,
  user_id,
  CASE WHEN member_rank = 1 THEN 'ADMIN' WHEN member_rank % 10 = 0 THEN 'BILLING' ELSE 'MEMBER' END,
  CASE WHEN member_rank > 1 AND member_rank % 17 = 0 THEN 'INACTIVE' ELSE 'ACTIVE' END,
  joined_at,
  joined_at
FROM (
  SELECT
    seed_team.id AS team_id,
    seed_user.id AS user_id,
    greatest(seed_user.created_at, seed_team.created_at) AS joined_at,
    row_number() OVER (PARTITION BY seed_team.id ORDER BY seed_user.user_number) AS member_rank
  FROM seed_user
  JOIN seed_team ON seed_team.team_number = 1 + (seed_user.user_number / 7) % :team_count
  WHERE seed_user.user_number % 7 = 0
) AS membership;

-- Seat limits leave 0-3 seats free, so some teams are exactly full
INSERT INTO team_billing_account ("teamId", "customerId", "manualBilling", "licenseCountLimit", "seatQuantity", "createdAt", "updatedAt")
SELECT
  seed_team.id,
  'cus_seed_t' || seed_team.team_number,
  seed_team.billing_status = 'MANUAL',
  seats_used + seed_team.team_number % 4,
  CASE WHEN seed_team.billing_status = 'MANUAL' THEN NULL ELSE seats_used + seed_team.team_number % 4 END,
  seed_team.created_at,
  seed_team.created_at
FROM seed_team
CROSS JOIN LATERAL (
  SELECT count(*)::int AS seats_used
  FROM team_member
  WHERE "teamId" = seed_team.id AND status = 'ACTIVE' AND role IN ('ADMIN', 'MEMBER')
) AS seat_usage;

INSERT INTO team_subscription ("teamId", "customerId", "subscriptionId", "priceId", status, "createdAt", "updatedAt")
SELECT
  id,
  'cus_seed_t' || team_number,
  'sub_seed_t' || team_number,
  'price_seed_team_annual',
  CASE WHEN billing_status = 'PAST_DUE' THEN 'PAST_DUE' ELSE 'ACTIVE' END,
  created_at,
  created_at
FROM seed_team;

-- Pending domains for trying out domain approval
INSERT INTO domain_verification ("teamId", domain, status, "verificationCode", "updatedAt")
SELECT id, 'seed-team-' || team_number || '.test', 'PENDING', 'jetstream-verification=seed' || team_number, now()
FROM seed_team
WHERE team_number % 4 = 0;

COMMIT;

SELECT
  (SELECT count(*) FROM "User" WHERE "userId" LIKE 'seed|%') AS seeded_users,
  (SELECT count(*) FROM team WHERE name LIKE '[seed] %') AS seeded_teams,
  (SELECT count(*) FROM team_member tm JOIN team t ON t.id = tm."teamId" WHERE t.name LIKE '[seed] %') AS seeded_memberships,
  (SELECT count(*) FROM subscription WHERE "subscriptionId" LIKE 'sub_seed_%') AS seeded_personal_subscriptions;
