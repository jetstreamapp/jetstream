\set ON_ERROR_STOP true

-- Connectors
CREATE TABLE connectors (
  id                      UUID         NOT NULL,
  data                    TEXT         NOT NULL,
  insert_instant          BIGINT       NOT NULL,
  last_update_instant     BIGINT       NOT NULL,
  name                    VARCHAR(191) NOT NULL,
  reconcile_lambdas_id    UUID         NULL,
  ssl_certificate_keys_id UUID         NULL,
  type                    SMALLINT     NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT connectors_uk_1 UNIQUE (name),
  CONSTRAINT connectors_fk_1 FOREIGN KEY (ssl_certificate_keys_id) REFERENCES keys(id),
  CONSTRAINT connectors_fk_2 FOREIGN KEY (reconcile_lambdas_id) REFERENCES lambdas(id)
);

CREATE TABLE connectors_tenants (
  connectors_id UUID     NOT NULL,
  data          TEXT     NOT NULL,
  sequence      SMALLINT NOT NULL,
  tenants_id    UUID     NOT NULL,
  PRIMARY KEY (connectors_id, tenants_id),
  CONSTRAINT connectors_tenants_uk_1 UNIQUE (connectors_id, tenants_id, sequence),
  CONSTRAINT connectors_tenants_fk_1 FOREIGN KEY (connectors_id) REFERENCES connectors(id),
  CONSTRAINT connectors_tenants_fk_2 FOREIGN KEY (tenants_id) REFERENCES tenants(id)
);

-- Create the FusionAuth Connector
INSERT INTO connectors (id, insert_instant, last_update_instant, data, name, type)
  VALUES ('e3306678a53a496490401c96f36dda72', (EXTRACT(EPOCH FROM NOW()) + 1) * 1000, (EXTRACT(EPOCH FROM NOW()) + 1) * 1000, '{}', 'Default', 0);

-- Create a FusionAuth connector policy with an "run always" trigger for all existing Tenants
INSERT INTO connectors_tenants (tenants_id, connectors_id, sequence, data)
SELECT id, 'e3306678a53a496490401c96f36dda72', 0, '{"domains":["*"]}'
  FROM tenants;

-- Add the connectors Id as foreign key to the identities table by creating a copy of the table and moving the data to the new table
ALTER TABLE identities
  RENAME TO old_identities;
ALTER TABLE old_identities
  ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE identities_id_seq;

CREATE TABLE identities (
  id                                     BIGSERIAL,
  breached_password_last_checked_instant BIGINT       NULL,
  breached_password_status               SMALLINT     NULL,
  connectors_id                          UUID         NOT NULL,
  email                                  VARCHAR(191) NULL,
  encryption_scheme                      VARCHAR(255) NOT NULL,
  factor                                 INTEGER      NOT NULL,
  insert_instant                         BIGINT       NOT NULL,
  last_login_instant                     BIGINT       NULL,
  last_update_instant                    BIGINT       NOT NULL,
  password                               VARCHAR(255) NOT NULL,
  password_change_reason                 SMALLINT     NULL,
  password_change_required               BOOLEAN      NOT NULL,
  password_last_update_instant           BIGINT       NOT NULL,
  salt                                   VARCHAR(255) NOT NULL,
  status                                 SMALLINT     NOT NULL,
  tenants_id                             UUID         NOT NULL,
  two_factor_delivery                    SMALLINT     NOT NULL,
  two_factor_enabled                     BOOLEAN      NOT NULL,
  two_factor_secret                      VARCHAR(255) NULL,
  username                               VARCHAR(191) NULL,
  username_index                         VARCHAR(191) NULL,
  username_status                        SMALLINT     NOT NULL,
  users_id                               UUID         NOT NULL,
  verified                               BOOLEAN      NOT NULL,
  PRIMARY KEY (id)
);

INSERT INTO identities (breached_password_last_checked_instant, breached_password_status, connectors_id, email, encryption_scheme, factor,
                        id, insert_instant, last_login_instant, last_update_instant, password, password_change_reason, password_change_required,
                        password_last_update_instant, salt, status, tenants_id, two_factor_delivery, two_factor_enabled, two_factor_secret,
                        username, username_index, username_status, users_id, verified)
SELECT breached_password_last_checked_instant, breached_password_status, 'e3306678a53a496490401c96f36dda72', email, encryption_scheme,
  factor, id, 0, last_login_instant, 0, password, password_change_reason, password_change_required, password_last_update_instant, salt,
  status, tenants_id, two_factor_delivery, two_factor_enabled, two_factor_secret, username, username_index, username_status, users_id,
  verified
  FROM old_identities;

DROP INDEX identities_i_1;
DROP TABLE old_identities;

ALTER TABLE identities
  ADD CONSTRAINT identities_uk_1 UNIQUE (email, tenants_id),
  ADD CONSTRAINT identities_uk_2 UNIQUE (username_index, tenants_id),
  ADD CONSTRAINT identities_fk_1 FOREIGN KEY (tenants_id) REFERENCES tenants(id);
  -- Skip the constraint to users because we add it below to reduce the hit

CREATE INDEX identities_i_1 ON identities(users_id);


-- Custom Registration Forms

-- Fields
CREATE TABLE form_fields (
  id                  UUID         NOT NULL,
  consents_id         UUID         NULL,
  data                TEXT         NULL,
  insert_instant      BIGINT       NOT NULL,
  last_update_instant BIGINT       NOT NULL,
  name                VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT form_fields_uk_1 UNIQUE (name),
  CONSTRAINT form_fields_fk_1 FOREIGN KEY (consents_id) REFERENCES consents(id)
);

-- Forms
CREATE TABLE forms (
  id                  UUID         NOT NULL,
  data                TEXT         NULL,
  insert_instant      BIGINT       NOT NULL,
  last_update_instant BIGINT       NOT NULL,
  name                VARCHAR(191) NOT NULL,
  type                SMALLINT     NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT forms_uk_1 UNIQUE (name)
);

-- Form Steps
CREATE TABLE form_steps (
  form_fields_id UUID     NOT NULL,
  forms_id       UUID     NOT NULL,
  sequence       SMALLINT NOT NULL,
  step           SMALLINT NOT NULL,
  PRIMARY KEY (forms_id, form_fields_id),
  CONSTRAINT form_steps_fk_1 FOREIGN KEY (forms_id) REFERENCES forms(id),
  CONSTRAINT form_steps_fk_2 FOREIGN KEY (form_fields_id) REFERENCES form_fields(id)
);

-- Form Roles
INSERT INTO application_roles(id, applications_id, is_default, is_super_role, name, description)
  VALUES ('631ecd9d8d404c13827780cedb823700', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'connector_deleter', 'Connector deleter'),
  ('631ecd9d8d404c13827780cedb823701', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'connector_manager', 'Connector manager'),
  ('631ecd9d8d404c13827780cedb823702', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'form_deleter', 'Form deleter'),
  ('631ecd9d8d404c13827780cedb823703', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'form_manager', 'Form manager');

-- Form Fields
INSERT INTO form_fields (id, data, insert_instant, last_update_instant, name)
  VALUES (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.email", "control": "text", "required": true, "type": "email", "data": {"leftAddon": "user"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'Email'),
  (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.password", "control": "password", "required": true, "type": "string", "data": {"leftAddon": "lock"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'Password'),
  (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.firstName", "control": "text", "required": false, "type": "string", "data": {"leftAddon": "info"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'First name'),
  (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.middleName", "control": "text", "required": false, "type": "string", "data": {"leftAddon": "info"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'Middle name'),
  (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.lastName", "control": "text", "required": false, "type": "string", "data": {"leftAddon": "info"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'Last name'),
  (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.fullName", "control": "text", "required": false, "type": "string", "data": {"leftAddon": "info"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'Full name'),
  (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.birthDate", "control": "text", "required": false, "type": "date", "data": {"leftAddon": "calendar"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'Birthdate'),
  (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.mobilePhone", "control": "text", "required": false, "type": "string", "data": {"leftAddon": "mobile"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'Mobile phone'),
  (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, '{"key": "user.username", "control": "text", "required": true, "type": "string", "data": {"leftAddon": "user"}}', (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, (EXTRACT(EPOCH FROM (SELECT NOW() AT TIME ZONE 'UTC'))) * 1000, 'Username');

-- Add a FK to the applications table
ALTER TABLE applications
  ADD COLUMN forms_id            UUID   NULL,
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL,
  ADD CONSTRAINT applications_fk_9 FOREIGN KEY (forms_id) REFERENCES forms(id);

-- Set existing applications to 'basic' self service registration
UPDATE applications
SET insert_instant    = 0,
  last_update_instant = 0,
  data                = JSONB_SET(data::JSONB, '{registrationConfiguration, type}', '"basic"');
ALTER TABLE applications
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- Add a missing lock
INSERT INTO locks(type)
  VALUES ('EmailPlus');


-- Normalize all tables to have insert_instant and last_update_instant (with a few exceptions)

-- email_templates
ALTER TABLE email_templates
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE email_templates
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE email_templates
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- user_actions
ALTER TABLE user_actions
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE user_actions
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE user_actions
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;


-- user_action_reasons
ALTER TABLE user_action_reasons
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE user_action_reasons
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE user_action_reasons
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;


-- keys
ALTER TABLE keys
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE keys
SET last_update_instant = 0;

ALTER TABLE keys
  ALTER COLUMN last_update_instant SET NOT NULL;


-- tenants
ALTER TABLE tenants
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE tenants
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE tenants
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;


-- lambdas
ALTER TABLE lambdas
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE lambdas
SET last_update_instant = 0;

ALTER TABLE lambdas
  ALTER COLUMN last_update_instant SET NOT NULL;

-- Add the last_update_instant to the user table but also fix up the identities reference here to reduce the hit on that table
ALTER TABLE users
  RENAME TO old_users;
ALTER TABLE old_users
  DROP CONSTRAINT users_fk_1;
ALTER TABLE user_consents
  DROP CONSTRAINT user_consents_fk_2,
  DROP CONSTRAINT user_consents_fk_3;
ALTER TABLE external_identifiers
  DROP CONSTRAINT external_identifiers_fk_1;
ALTER TABLE user_registrations
  DROP CONSTRAINT user_registrations_fk_2;
ALTER TABLE families
  DROP CONSTRAINT families_fk_1;
ALTER TABLE group_members
  DROP CONSTRAINT group_members_fk_1;
ALTER TABLE user_action_logs
  DROP CONSTRAINT user_action_logs_fk_1,
  DROP CONSTRAINT user_action_logs_fk_2;
ALTER TABLE user_comments
  DROP CONSTRAINT user_comments_fk_1,
  DROP CONSTRAINT user_comments_fk_2;
ALTER TABLE raw_logins
  DROP CONSTRAINT raw_logins_fk_2;
ALTER TABLE refresh_tokens
  DROP CONSTRAINT refresh_tokens_fk_1;
ALTER TABLE previous_passwords
  DROP CONSTRAINT previous_passwords_fk_1;
ALTER TABLE failed_logins
  DROP CONSTRAINT failed_logins_fk_1;

CREATE TABLE users (
  id                  UUID         NOT NULL,
  active              BOOLEAN      NOT NULL,
  birth_date          CHAR(10)     NULL,
  clean_speak_id      UUID         NULL,
  data                TEXT         NULL,
  expiry              BIGINT       NULL,
  first_name          VARCHAR(255) NULL,
  full_name           VARCHAR(255) NULL,
  image_url           TEXT         NULL,
  insert_instant      BIGINT       NOT NULL,
  last_name           VARCHAR(255) NULL,
  last_update_instant BIGINT       NOT NULL,
  middle_name         VARCHAR(255) NULL,
  mobile_phone        VARCHAR(255) NULL,
  parent_email        VARCHAR(255) NULL,
  tenants_id          UUID         NOT NULL,
  timezone            VARCHAR(255) NULL
);

INSERT INTO users (id, active, birth_date, clean_speak_id, data, expiry, first_name, full_name, image_url, insert_instant, last_name,
                   last_update_instant, middle_name, mobile_phone, parent_email, tenants_id, timezone)
SELECT id, active, birth_date, clean_speak_id, data, expiry, first_name, full_name, image_url, insert_instant, last_name,
  0, middle_name, mobile_phone, parent_email, tenants_id, timezone
  FROM old_users;

DROP INDEX users_i_1;
DROP INDEX users_i_2;
DROP TABLE old_users;

ALTER TABLE users
  ADD PRIMARY KEY (id),
  ADD CONSTRAINT users_fk_1 FOREIGN KEY (tenants_id) REFERENCES tenants(id);
ALTER TABLE user_consents
  ADD CONSTRAINT user_consents_fk_2 FOREIGN KEY (giver_users_id) REFERENCES users(id),
  ADD CONSTRAINT user_consents_fk_3 FOREIGN KEY (users_id) REFERENCES users(id);
ALTER TABLE external_identifiers
  ADD CONSTRAINT external_identifiers_fk_1 FOREIGN KEY (users_id) REFERENCES users(id);
-- Skip the foreign key on user_registrations here since we will create it below
ALTER TABLE families
  ADD CONSTRAINT families_fk_1 FOREIGN KEY (users_id) REFERENCES users(id);
ALTER TABLE group_members
  ADD CONSTRAINT group_members_fk_1 FOREIGN KEY (users_id) REFERENCES users(id);
ALTER TABLE user_action_logs
  ADD CONSTRAINT user_action_logs_fk_1 FOREIGN KEY (actioner_users_id) REFERENCES users(id),
  ADD CONSTRAINT user_action_logs_fk_2 FOREIGN KEY (actionee_users_id) REFERENCES users(id);
ALTER TABLE user_comments
  ADD CONSTRAINT user_comments_fk_1 FOREIGN KEY (users_id) REFERENCES users(id),
  ADD CONSTRAINT user_comments_fk_2 FOREIGN KEY (commenter_id) REFERENCES users(id);
ALTER TABLE raw_logins
  ADD CONSTRAINT raw_logins_fk_2 FOREIGN KEY (users_id) REFERENCES users(id);
ALTER TABLE refresh_tokens
  ADD CONSTRAINT refresh_tokens_fk_1 FOREIGN KEY (users_id) REFERENCES users(id);
ALTER TABLE previous_passwords
  ADD CONSTRAINT previous_passwords_fk_1 FOREIGN KEY (users_id) REFERENCES users(id);
ALTER TABLE failed_logins
  ADD CONSTRAINT failed_logins_fk_1 FOREIGN KEY (users_id) REFERENCES users(id);
ALTER TABLE identities
  ADD CONSTRAINT identities_fk_2 FOREIGN KEY (users_id) REFERENCES users(id);

CREATE INDEX users_i_1 ON users(clean_speak_id);
CREATE INDEX users_i_2 ON users(parent_email);

-- consents
ALTER TABLE consents
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE consents
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE consents
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- application_roles
ALTER TABLE application_roles
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE application_roles
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE application_roles
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- groups
ALTER TABLE groups
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE groups
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE groups
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- webhooks
ALTER TABLE webhooks
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE webhooks
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE webhooks
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- Add last_update_instant to user_registrations by making a copy of the table (big table)
ALTER TABLE user_registrations
  RENAME TO old_user_registrations;
ALTER TABLE old_user_registrations
  DROP CONSTRAINT user_registrations_uk_1,
  DROP CONSTRAINT user_registrations_fk_1;

ALTER TABLE user_registrations_application_roles
DROP CONSTRAINT user_registrations_application_roles_fk_1;

CREATE TABLE user_registrations (
  id                   UUID         NOT NULL,
  applications_id      UUID         NOT NULL,
  authentication_token VARCHAR(255) NULL,
  clean_speak_id       UUID         NULL,
  data                 TEXT         NULL,
  insert_instant       BIGINT       NOT NULL,
  last_login_instant   BIGINT       NULL,
  last_update_instant  BIGINT       NOT NULL,
  timezone             VARCHAR(255) NULL,
  username             VARCHAR(191) NULL,
  username_status      SMALLINT     NOT NULL,
  users_id             UUID         NOT NULL,
  verified             BOOLEAN      NOT NULL
);

INSERT INTO user_registrations (id, applications_id, authentication_token, clean_speak_id, data, insert_instant, last_login_instant, last_update_instant, timezone, username, username_status, users_id, verified)
SELECT id, applications_id, authentication_token, clean_speak_id, data, insert_instant, last_login_instant, 0, timezone, username,
  username_status, users_id, verified
  FROM old_user_registrations;

DROP INDEX user_registrations_i_1;
DROP INDEX user_registrations_i_2;
DROP TABLE old_user_registrations;

ALTER TABLE user_registrations
  ADD PRIMARY KEY (id),
  ADD CONSTRAINT user_registrations_uk_1 UNIQUE (applications_id, users_id),
  ADD CONSTRAINT user_registrations_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  ADD CONSTRAINT user_registrations_fk_2 FOREIGN KEY (users_id) REFERENCES users(id);

ALTER TABLE user_registrations_application_roles
  ADD CONSTRAINT user_registrations_application_roles_fk_1 FOREIGN KEY (user_registrations_id) REFERENCES user_registrations(id);

CREATE INDEX user_registrations_i_1 ON user_registrations(clean_speak_id);
CREATE INDEX user_registrations_i_2 ON user_registrations(users_id);

-- families
ALTER TABLE families
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE families
SET last_update_instant = 0;

ALTER TABLE families
  ALTER COLUMN last_update_instant SET NOT NULL;

-- user_action_logs
ALTER TABLE user_action_logs
  RENAME create_instant TO insert_instant;

-- user_comments
ALTER TABLE user_comments
  RENAME create_instant TO insert_instant;

-- authentication_keys
ALTER TABLE authentication_keys
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE authentication_keys
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE authentication_keys
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- system_configuration
ALTER TABLE system_configuration
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE system_configuration
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE system_configuration
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- previous_passwords
ALTER TABLE previous_passwords
  RENAME create_instant TO insert_instant;

-- identity_providers
ALTER TABLE identity_providers
  ADD COLUMN insert_instant      BIGINT NULL,
  ADD COLUMN last_update_instant BIGINT NULL;

UPDATE identity_providers
SET insert_instant    = 0,
  last_update_instant = 0;

ALTER TABLE identity_providers
  ALTER COLUMN insert_instant SET NOT NULL,
  ALTER COLUMN last_update_instant SET NOT NULL;

-- Update the version
UPDATE version
SET version = '1.18.0';