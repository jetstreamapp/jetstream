\set ON_ERROR_STOP true

DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS user_actions CASCADE;
DROP TABLE IF EXISTS user_action_reasons CASCADE;
DROP TABLE IF EXISTS keys CASCADE;
DROP TABLE IF EXISTS themes CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS lambdas CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS clean_speak_applications CASCADE;
DROP TABLE IF EXISTS application_roles CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS group_application_roles CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS webhooks_applications CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS external_identifiers CASCADE;
DROP TABLE IF EXISTS user_registrations CASCADE;
DROP TABLE IF EXISTS user_registrations_application_roles CASCADE;
DROP TABLE IF EXISTS families CASCADE;
DROP TABLE IF EXISTS consents CASCADE;
DROP TABLE IF EXISTS user_consents CASCADE;
DROP TABLE IF EXISTS user_consents_email_plus CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS user_action_logs CASCADE;
DROP TABLE IF EXISTS user_action_logs_applications CASCADE;
DROP TABLE IF EXISTS user_comments CASCADE;
DROP TABLE IF EXISTS authentication_keys CASCADE;
DROP TABLE IF EXISTS system_configuration CASCADE;
DROP TABLE IF EXISTS raw_logins CASCADE;
DROP TABLE IF EXISTS hourly_logins CASCADE;
DROP TABLE IF EXISTS raw_global_daily_active_users CASCADE;
DROP TABLE IF EXISTS global_daily_active_users CASCADE;
DROP TABLE IF EXISTS raw_application_daily_active_users CASCADE;
DROP TABLE IF EXISTS application_daily_active_users CASCADE;
DROP TABLE IF EXISTS raw_global_monthly_active_users CASCADE;
DROP TABLE IF EXISTS global_monthly_active_users CASCADE;
DROP TABLE IF EXISTS raw_application_monthly_active_users CASCADE;
DROP TABLE IF EXISTS application_monthly_active_users CASCADE;
DROP TABLE IF EXISTS global_registration_counts CASCADE;
DROP TABLE IF EXISTS application_registration_counts CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS event_logs CASCADE;
DROP TABLE IF EXISTS locks CASCADE;
DROP TABLE IF EXISTS master_record CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS previous_passwords CASCADE;
DROP TABLE IF EXISTS version CASCADE;
DROP TABLE IF EXISTS migrations CASCADE;
DROP TABLE IF EXISTS integrations CASCADE;
DROP TABLE IF EXISTS identity_providers CASCADE;
DROP TABLE IF EXISTS identity_providers_applications CASCADE;
DROP TABLE IF EXISTS federated_domains CASCADE;
DROP TABLE IF EXISTS failed_logins CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS identities CASCADE;
DROP TABLE IF EXISTS instance CASCADE;
DROP TABLE IF EXISTS common_breached_passwords CASCADE;
DROP TABLE IF EXISTS data_sets CASCADE;
DROP TABLE IF EXISTS breached_password_metrics CASCADE;

CREATE TABLE email_templates (
  id                       UUID         NOT NULL,
  default_from_name        VARCHAR(255) NULL,
  default_html_template    TEXT         NOT NULL,
  default_subject          VARCHAR(255) NOT NULL,
  default_text_template    TEXT         NOT NULL,
  from_email               VARCHAR(255) NULL,
  localized_from_names     TEXT         NULL,
  localized_html_templates TEXT         NOT NULL,
  localized_subjects       TEXT         NOT NULL,
  localized_text_templates TEXT         NOT NULL,
  name                     VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT email_templates_uk_1 UNIQUE (name)
);

CREATE TABLE user_actions (
  id                          UUID         NOT NULL,
  active                      BOOLEAN      NOT NULL,
  cancel_email_templates_id   UUID         NULL,
  end_email_templates_id      UUID         NULL,
  include_email_in_event_json BOOLEAN      NOT NULL,
  localized_names             TEXT         NULL,
  modify_email_templates_id   UUID         NULL,
  name                        VARCHAR(191) NOT NULL,
  options                     TEXT         NULL,
  prevent_login               BOOLEAN      NOT NULL,
  send_end_event              BOOLEAN      NOT NULL,
  start_email_templates_id    UUID         NULL,
  temporal                    BOOLEAN      NOT NULL,
  transaction_type            SMALLINT     NOT NULL,
  user_notifications_enabled  BOOLEAN      NOT NULL,
  user_emailing_enabled       BOOLEAN      NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT user_actions_uk_1 UNIQUE (name),
  CONSTRAINT user_actions_fk_1 FOREIGN KEY (cancel_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT user_actions_fk_2 FOREIGN KEY (end_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT user_actions_fk_3 FOREIGN KEY (modify_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT user_actions_fk_4 FOREIGN KEY (start_email_templates_id) REFERENCES email_templates(id)
);

CREATE TABLE user_action_reasons (
  id              UUID         NOT NULL,
  localized_texts TEXT         NULL,
  text            VARCHAR(191) NOT NULL,
  code            VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT user_action_reasons_uk_1 UNIQUE (text),
  CONSTRAINT user_action_reasons_uk_2 UNIQUE (code)
);

CREATE TABLE keys (
  id                 UUID         NOT NULL,
  algorithm          VARCHAR(10)  NULL,
  certificate        TEXT         NULL,
  expiration_instant BIGINT       NULL,
  insert_instant     BIGINT       NOT NULL,
  issuer             VARCHAR(255) NULL,
  kid                VARCHAR(191) NOT NULL,
  name               VARCHAR(191) NOT NULL,
  private_key        TEXT         NULL,
  public_key         TEXT         NULL,
  secret             TEXT         NULL,
  type               VARCHAR(10)  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT keys_uk_1 UNIQUE (kid),
  CONSTRAINT keys_uk_2 UNIQUE (name)
);

-- UI Theme
CREATE TABLE themes (
  id                  UUID         NOT NULL,
  data                TEXT         NOT NULL,
  insert_instant      BIGINT       NOT NULL,
  last_update_instant BIGINT       NOT NULL,
  name                VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT themes_uk_1 UNIQUE (name)
);

CREATE TABLE tenants (
  id                                    UUID         NOT NULL,
  access_token_signing_keys_id          UUID         NOT NULL,
  confirm_child_email_template_id       UUID         NULL,
  data                                  TEXT         NULL,
  failed_authentication_user_actions_id UUID         NULL,
  family_request_email_template_id      UUID         NULL,
  forgot_password_email_templates_id    UUID         NULL,
  id_token_signing_keys_id              UUID         NOT NULL,
  name                                  VARCHAR(191) NOT NULL,
  parent_registration_email_template_id UUID         NULL,
  passwordless_email_templates_id       UUID         NULL,
  set_password_email_templates_id       UUID         NULL,
  themes_id                             UUID         NOT NULL,
  verification_email_templates_id       UUID         NULL,
  PRIMARY KEY (id),
  CONSTRAINT tenants_fk_1 FOREIGN KEY (forgot_password_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT tenants_fk_2 FOREIGN KEY (set_password_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT tenants_fk_3 FOREIGN KEY (verification_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT tenants_fk_4 FOREIGN KEY (passwordless_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT tenants_fk_5 FOREIGN KEY (confirm_child_email_template_id) REFERENCES email_templates(id),
  CONSTRAINT tenants_fk_6 FOREIGN KEY (family_request_email_template_id) REFERENCES email_templates(id),
  CONSTRAINT tenants_fk_7 FOREIGN KEY (parent_registration_email_template_id) REFERENCES email_templates(id),
  CONSTRAINT tenants_fk_8 FOREIGN KEY (failed_authentication_user_actions_id) REFERENCES user_actions(id),
  CONSTRAINT tenants_fk_9 FOREIGN KEY (themes_id) REFERENCES themes(id),
  CONSTRAINT tenants_fk_10 FOREIGN KEY (access_token_signing_keys_id) REFERENCES keys(id),
  CONSTRAINT tenants_fk_11 FOREIGN KEY (id_token_signing_keys_id) REFERENCES keys(id),
  CONSTRAINT tenants_uk_1 UNIQUE (name)
);

CREATE TABLE lambdas (
  id             UUID         NOT NULL,
  body           TEXT         NOT NULL,
  debug          BOOLEAN      NOT NULL,
  enabled        BOOLEAN      NOT NULL,
  insert_instant BIGINT       NOT NULL,
  name           VARCHAR(255) NOT NULL,
  type           SMALLINT     NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE applications (
  id                               UUID         NOT NULL,
  access_token_populate_lambdas_id UUID         NULL,
  access_token_signing_keys_id     UUID         NULL,
  active                           BOOLEAN      NOT NULL,
  data                             TEXT         NOT NULL,
  id_token_populate_lambdas_id     UUID         NULL,
  id_token_signing_keys_id         UUID         NULL,
  name                             VARCHAR(191) NOT NULL,
  samlv2_issuer                    VARCHAR(191) NULL,
  samlv2_keys_id                   UUID         NULL,
  samlv2_populate_lambdas_id       UUID         NULL,
  tenants_id                       UUID         NOT NULL,
  verification_email_templates_id  UUID         NULL,
  PRIMARY KEY (id),
  CONSTRAINT applications_uk_1 UNIQUE (name, tenants_id),
  CONSTRAINT applications_uk_2 UNIQUE (samlv2_issuer, tenants_id),
  CONSTRAINT applications_fk_1 FOREIGN KEY (verification_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT applications_fk_2 FOREIGN KEY (tenants_id) REFERENCES tenants(id),
  CONSTRAINT applications_fk_3 FOREIGN KEY (access_token_populate_lambdas_id) REFERENCES lambdas(id),
  CONSTRAINT applications_fk_4 FOREIGN KEY (id_token_populate_lambdas_id) REFERENCES lambdas(id),
  CONSTRAINT applications_fk_5 FOREIGN KEY (samlv2_keys_id) REFERENCES keys(id),
  CONSTRAINT applications_fk_6 FOREIGN KEY (samlv2_populate_lambdas_id) REFERENCES lambdas(id),
  CONSTRAINT applications_fk_7 FOREIGN KEY (access_token_signing_keys_id) REFERENCES keys(id),
  CONSTRAINT applications_fk_8 FOREIGN KEY (id_token_signing_keys_id) REFERENCES keys(id)
);
CREATE INDEX applications_i_1 ON applications(tenants_id);

CREATE TABLE clean_speak_applications (
  applications_id            UUID NOT NULL,
  clean_speak_application_id UUID NOT NULL,
  CONSTRAINT clean_speak_applications_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT clean_speak_applications_uk_1 UNIQUE (applications_id, clean_speak_application_id)
);

CREATE TABLE application_roles (
  id              UUID         NOT NULL,
  applications_id UUID         NOT NULL,
  description     VARCHAR(255) NULL,
  is_default      BOOLEAN      NOT NULL,
  is_super_role   BOOLEAN      NOT NULL,
  name            VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT application_roles_uk_1 UNIQUE (name, applications_id),
  CONSTRAINT application_roles_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id)
);

CREATE TABLE groups (
  id         UUID         NOT NULL,
  data       TEXT         NULL,
  name       VARCHAR(191) NOT NULL,
  tenants_id UUID         NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT groups_uk_1 UNIQUE (name, tenants_id),
  CONSTRAINT groups_fk_1 FOREIGN KEY (tenants_id) REFERENCES tenants(id)
);

CREATE TABLE group_application_roles (
  application_roles_id UUID NOT NULL,
  groups_id            UUID NOT NULL,
  CONSTRAINT group_application_roles_uk_1 UNIQUE (groups_id, application_roles_id),
  CONSTRAINT group_application_roles_fk_1 FOREIGN KEY (groups_id) REFERENCES groups(id),
  CONSTRAINT group_application_roles_fk_2 FOREIGN KEY (application_roles_id) REFERENCES application_roles(id)
);

CREATE TABLE webhooks (
  id                           UUID         NOT NULL,
  connect_timeout              INTEGER      NOT NULL,
  description                  VARCHAR(255) NULL,
  data                         TEXT         NULL,
  global                       BOOLEAN      NOT NULL,
  headers                      TEXT         NULL,
  http_authentication_username VARCHAR(255) NULL,
  http_authentication_password VARCHAR(255) NULL,
  read_timeout                 INTEGER      NOT NULL,
  ssl_certificate              TEXT         NULL,
  url                          TEXT         NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE webhooks_applications (
  webhooks_id     UUID NOT NULL,
  applications_id UUID NOT NULL,
  PRIMARY KEY (webhooks_id, applications_id),
  CONSTRAINT webhooks_applications_fk_1 FOREIGN KEY (webhooks_id) REFERENCES webhooks(id),
  CONSTRAINT webhooks_applications_fk_2 FOREIGN KEY (applications_id) REFERENCES applications(id)
);

CREATE TABLE users (
  id             UUID         NOT NULL,
  active         BOOLEAN      NOT NULL,
  birth_date     CHAR(10)     NULL,
  clean_speak_id UUID         NULL,
  data           TEXT         NULL,
  expiry         BIGINT       NULL,
  first_name     VARCHAR(255) NULL,
  full_name      VARCHAR(255) NULL,
  image_url      TEXT         NULL,
  insert_instant BIGINT       NOT NULL,
  last_name      VARCHAR(255) NULL,
  middle_name    VARCHAR(255) NULL,
  mobile_phone   VARCHAR(255) NULL,
  parent_email   VARCHAR(255) NULL,
  tenants_id     UUID         NOT NULL,
  timezone       VARCHAR(255) NULL,
  PRIMARY KEY (id),
  CONSTRAINT users_fk_1 FOREIGN KEY (tenants_id) REFERENCES tenants(id)
);
CREATE INDEX users_i_1 ON users(clean_speak_id);
CREATE INDEX users_i_2 ON users(parent_email);

-- External User Ids
CREATE TABLE external_identifiers (
  id              VARCHAR(191) NOT NULL,
  applications_id UUID         NULL,
  data            TEXT         NULL,
  insert_instant  BIGINT       NOT NULL,
  tenants_id      UUID         NOT NULL,
  type            SMALLINT     NOT NULL,
  users_id        UUID         NULL,
  PRIMARY KEY (id),
  CONSTRAINT external_identifiers_fk_1 FOREIGN KEY (users_id) REFERENCES users(id),
  CONSTRAINT external_identifiers_fk_2 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT external_identifiers_fk_3 FOREIGN KEY (tenants_id) REFERENCES tenants(id)
);
CREATE INDEX external_identifiers_i_1 ON external_identifiers(tenants_id, type, insert_instant);
CREATE INDEX external_identifiers_i_2 ON external_identifiers(type, users_id, applications_id);

CREATE TABLE user_registrations (
  id                   UUID         NOT NULL,
  applications_id      UUID         NOT NULL,
  authentication_token VARCHAR(255) NULL,
  clean_speak_id       UUID         NULL,
  data                 TEXT         NULL,
  insert_instant       BIGINT       NOT NULL,
  last_login_instant   BIGINT       NULL,
  timezone             VARCHAR(255) NULL,
  username             VARCHAR(191) NULL,
  username_status      SMALLINT     NOT NULL,
  users_id             UUID         NOT NULL,
  verified             BOOLEAN      NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT user_registrations_uk_1 UNIQUE (applications_id, users_id),
  CONSTRAINT user_registrations_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT user_registrations_fk_2 FOREIGN KEY (users_id) REFERENCES users(id)
);
CREATE INDEX user_registrations_i_1 ON user_registrations(clean_speak_id);
-- No need to create an explicit index on applications_id because it is the first key in the UNIQUE constraint
CREATE INDEX user_registrations_i_2 ON user_registrations(users_id);

CREATE TABLE user_registrations_application_roles (
  application_roles_id  UUID NOT NULL,
  user_registrations_id UUID NOT NULL,
  CONSTRAINT user_registrations_application_roles_uk_1 UNIQUE (user_registrations_id, application_roles_id),
  CONSTRAINT user_registrations_application_roles_fk_1 FOREIGN KEY (user_registrations_id) REFERENCES user_registrations(id),
  CONSTRAINT user_registrations_application_roles_fk_2 FOREIGN KEY (application_roles_id) REFERENCES application_roles(id)
);

CREATE TABLE families (
  data           TEXT     NULL,
  family_id      UUID     NOT NULL,
  insert_instant BIGINT   NOT NULL,
  owner          BOOLEAN  NOT NULL,
  role           SMALLINT NOT NULL,
  users_id       UUID     NOT NULL,
  PRIMARY KEY (family_id, users_id),
  CONSTRAINT families_fk_1 FOREIGN KEY (users_id) REFERENCES users(id)
);
CREATE INDEX families_i_1 ON families(users_id);

CREATE TABLE consents (
  id                            UUID         NOT NULL,
  consent_email_templates_id    UUID         NULL,
  data                          TEXT         NULL,
  name                          VARCHAR(191) NOT NULL,
  email_plus_email_templates_id UUID         NULL,
  PRIMARY KEY (id),
  CONSTRAINT consents_uk_1 UNIQUE (name),
  CONSTRAINT consents_fk_1 FOREIGN KEY (consent_email_templates_id) REFERENCES email_templates(id),
  CONSTRAINT consents_fk_2 FOREIGN KEY (email_plus_email_templates_id) REFERENCES email_templates(id)
);

CREATE TABLE user_consents (
  id                  UUID   NOT NULL,
  consents_id         UUID   NOT NULL,
  data                TEXT   NULL,
  giver_users_id      UUID   NOT NULL,
  insert_instant      BIGINT NOT NULL,
  last_update_instant BIGINT NOT NULL,
  users_id            UUID   NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT user_consents_fk_1 FOREIGN KEY (consents_id) REFERENCES consents(id),
  CONSTRAINT user_consents_fk_2 FOREIGN KEY (giver_users_id) REFERENCES users(id),
  CONSTRAINT user_consents_fk_3 FOREIGN KEY (users_id) REFERENCES users(id)
);

CREATE TABLE user_consents_email_plus (
  id                 BIGSERIAL,
  next_email_instant BIGINT NOT NULL,
  user_consents_id   UUID   NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT user_consents_email_plus_fk_1 FOREIGN KEY (user_consents_id) REFERENCES user_consents(id)
);
CREATE INDEX user_consents_email_plus_i_1 ON user_consents_email_plus(next_email_instant);

CREATE TABLE group_members (
  id             UUID   NOT NULL,
  groups_id      UUID   NOT NULL,
  data           TEXT   NULL,
  insert_instant BIGINT NOT NULL,
  users_id       UUID   NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT group_members_uk_1 UNIQUE (groups_id, users_id),
  CONSTRAINT group_members_fk_1 FOREIGN KEY (users_id) REFERENCES users(id),
  CONSTRAINT group_members_fk_2 FOREIGN KEY (groups_id) REFERENCES groups(id)
);
CREATE INDEX group_members_i_1 ON group_members(users_id);
-- No need to create an explicit index on groups_id because it is the first key in the UNIQUE constraint

CREATE TABLE user_action_logs (
  id                 UUID         NOT NULL,
  actioner_users_id  UUID         NULL,
  actionee_users_id  UUID         NOT NULL,
  comment            TEXT         NULL,
  create_instant     BIGINT       NOT NULL,
  email_user_on_end  BOOLEAN      NOT NULL,
  end_event_sent     BOOLEAN      NULL,
  expiry             BIGINT       NULL,
  history            TEXT         NULL,
  localized_name     VARCHAR(191) NULL,
  localized_option   VARCHAR(255) NULL,
  localized_reason   VARCHAR(255) NULL,
  name               VARCHAR(191) NULL,
  notify_user_on_end BOOLEAN      NOT NULL,
  option_name        VARCHAR(255) NULL,
  reason             VARCHAR(255) NULL,
  reason_code        VARCHAR(255) NULL,
  user_actions_id    UUID         NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT user_action_logs_fk_1 FOREIGN KEY (actioner_users_id) REFERENCES users(id),
  CONSTRAINT user_action_logs_fk_2 FOREIGN KEY (actionee_users_id) REFERENCES users(id),
  CONSTRAINT user_action_logs_fk_3 FOREIGN KEY (user_actions_id) REFERENCES user_actions(id)
);
CREATE INDEX user_action_logs_i_1 ON user_action_logs(create_instant);
CREATE INDEX user_action_logs_i_2 ON user_action_logs(expiry, end_event_sent);

CREATE TABLE user_action_logs_applications (
  applications_id     UUID NOT NULL,
  user_action_logs_id UUID NOT NULL,
  CONSTRAINT user_action_logs_applications_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id)
    ON DELETE CASCADE,
  CONSTRAINT user_action_logs_applications_fk_2 FOREIGN KEY (user_action_logs_id) REFERENCES user_action_logs(id)
    ON DELETE CASCADE
);

CREATE TABLE user_comments (
  id             UUID   NOT NULL,
  comment        TEXT   NULL,
  commenter_id   UUID   NOT NULL,
  create_instant BIGINT NOT NULL,
  users_id       UUID   NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT user_comments_fk_1 FOREIGN KEY (users_id) REFERENCES users(id),
  CONSTRAINT user_comments_fk_2 FOREIGN KEY (commenter_id) REFERENCES users(id)
);
CREATE INDEX user_comments_i_1 ON user_comments(create_instant);
CREATE INDEX user_comments_i_2 ON user_comments(users_id);
CREATE INDEX user_comments_i_3 ON user_comments(commenter_id);

CREATE TABLE authentication_keys (
  id          VARCHAR(191) NOT NULL,
  permissions TEXT         NULL,
  meta_data   TEXT         NULL,
  tenants_id  UUID         NULL,
  PRIMARY KEY (id),
  CONSTRAINT authentication_keys_fk_1 FOREIGN KEY (tenants_id) REFERENCES tenants(id)
);

CREATE TABLE system_configuration (
  data            TEXT         NOT NULL,
  report_timezone VARCHAR(255) NOT NULL
);

CREATE TABLE raw_logins (
  applications_id UUID         NULL,
  instant         BIGINT       NOT NULL,
  ip_address      VARCHAR(255) NULL,
  users_id        UUID         NOT NULL,
  CONSTRAINT raw_logins_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT raw_logins_fk_2 FOREIGN KEY (users_id) REFERENCES users(id)
);
CREATE INDEX raw_logins_i_1
  ON raw_logins(instant);
CREATE INDEX raw_logins_i_2
  ON raw_logins(users_id, instant);

CREATE TABLE hourly_logins (
  applications_id UUID    NOT NULL,
  count           INTEGER NOT NULL,
  data            TEXT    NULL,
  hour            INTEGER NOT NULL,
  CONSTRAINT hourly_logins_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT hourly_logins_uk_1 UNIQUE (applications_id, hour)
);

CREATE TABLE raw_global_daily_active_users (
  day      INTEGER NOT NULL,
  users_id UUID    NOT NULL,
  CONSTRAINT raw_global_daily_active_users_uk_1 UNIQUE (day, users_id)
);

CREATE TABLE global_daily_active_users (
  count INTEGER NOT NULL,
  day   INTEGER NOT NULL,
  CONSTRAINT global_daily_active_users_uk_1 UNIQUE (day)
);

CREATE TABLE raw_application_daily_active_users (
  applications_id UUID    NOT NULL,
  day             INTEGER NOT NULL,
  users_id        UUID    NOT NULL,
  CONSTRAINT raw_application_daily_active_users_uk_1 UNIQUE (applications_id, day, users_id)
);

CREATE TABLE application_daily_active_users (
  applications_id UUID    NOT NULL,
  count           INTEGER NOT NULL,
  day             INTEGER NOT NULL,
  CONSTRAINT application_daily_active_users_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT application_daily_active_users_uk_1 UNIQUE (applications_id, day)
);

CREATE TABLE raw_global_monthly_active_users (
  month    INTEGER NOT NULL,
  users_id UUID    NOT NULL,
  CONSTRAINT raw_global_monthly_active_users_uk_1 UNIQUE (month, users_id)
);

CREATE TABLE global_monthly_active_users (
  count INTEGER NOT NULL,
  month INTEGER NOT NULL,
  CONSTRAINT global_monthly_active_users_uk_1 UNIQUE (month)
);

CREATE TABLE raw_application_monthly_active_users (
  applications_id UUID    NOT NULL,
  month           INTEGER NOT NULL,
  users_id        UUID    NOT NULL,
  CONSTRAINT raw_application_monthly_active_users_uk_1 UNIQUE (applications_id, month, users_id)
);

CREATE TABLE application_monthly_active_users (
  applications_id UUID    NOT NULL,
  count           INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  CONSTRAINT application_monthly_active_users_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT application_monthly_active_users_uk_1 UNIQUE (applications_id, month)
);

CREATE TABLE global_registration_counts (
  count             INTEGER NOT NULL,
  decremented_count INTEGER NOT NULL,
  hour              INTEGER NOT NULL,
  CONSTRAINT global_registration_counts_uk_1 UNIQUE (hour)
);

CREATE TABLE application_registration_counts (
  applications_id   UUID    NOT NULL,
  count             INTEGER NOT NULL,
  decremented_count INTEGER NOT NULL,
  hour              INTEGER NOT NULL,
  CONSTRAINT application_registration_counts_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT application_registration_counts_uk_1 UNIQUE (applications_id, hour)
);

CREATE TABLE audit_logs (
  id             BIGSERIAL,
  insert_instant BIGINT       NOT NULL,
  insert_user    VARCHAR(255) NOT NULL,
  message        TEXT         NOT NULL,
  data           TEXT         NULL,
  PRIMARY KEY (id)
);
CREATE INDEX audit_logs_i1 ON audit_logs(insert_instant);

CREATE TABLE event_logs (
  id             BIGSERIAL,
  insert_instant BIGINT   NOT NULL,
  message        TEXT     NOT NULL,
  type           SMALLINT NOT NULL,
  PRIMARY KEY (id)
);
CREATE INDEX event_logs_i1 ON event_logs(insert_instant);

CREATE TABLE locks (
  type           VARCHAR(191) NOT NULL,
  update_instant BIGINT       NULL,
  PRIMARY KEY (type)
);

CREATE TABLE master_record (
  id      UUID   NOT NULL,
  instant BIGINT NOT NULL
);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
  token           VARCHAR(191) NOT NULL,
  users_id        UUID         NOT NULL,
  applications_id UUID         NOT NULL,
  insert_instant  BIGINT       NOT NULL,
  start_instant   BIGINT       NOT NULL,
  meta_data       TEXT         NOT NULL,
  PRIMARY KEY (token),
  CONSTRAINT refresh_tokens_fk_1 FOREIGN KEY (users_id) REFERENCES users(id),
  CONSTRAINT refresh_tokens_fk_2 FOREIGN KEY (applications_id) REFERENCES applications(id)
);
CREATE INDEX refresh_tokens_i_1 ON refresh_tokens(start_instant);
-- No need to create an explicit index on users_id because it is the first key in the UNIQUE constraint
CREATE INDEX refresh_tokens_i_3 ON refresh_tokens(applications_id);

-- Previous Passwords
CREATE TABLE previous_passwords (
  create_instant    BIGINT       NOT NULL,
  encryption_scheme VARCHAR(255) NOT NULL,
  factor            INTEGER      NOT NULL,
  password          VARCHAR(255) NOT NULL,
  salt              VARCHAR(255) NOT NULL,
  users_id          UUID         NOT NULL,
  CONSTRAINT previous_passwords_fk_1 FOREIGN KEY (users_id) REFERENCES users(id),
  CONSTRAINT previous_passwords_uk_1 UNIQUE (users_id, create_instant)
);
-- No need to create an explicit index on users_id because it is the first key in the UNIQUE constraint

CREATE TABLE version (
  version VARCHAR(255) NOT NULL
);

-- Migrations Table
CREATE TABLE migrations (
  name        VARCHAR(191) NOT NULL,
  run_instant BIGINT       NOT NULL,
  PRIMARY KEY (name)
);

-- Integrations
CREATE TABLE integrations (
  data TEXT NOT NULL
);

-- Identity Providers
CREATE TABLE identity_providers (
  id                   UUID         NOT NULL,
  data                 TEXT         NOT NULL,
  enabled              BOOLEAN      NOT NULL,
  name                 VARCHAR(191) NOT NULL,
  type                 VARCHAR(255) NOT NULL,
  keys_id              UUID         NULL,
  reconcile_lambdas_id UUID         NULL,
  PRIMARY KEY (id),
  CONSTRAINT identity_providers_uk_1 UNIQUE (name),
  CONSTRAINT identity_providers_fk_1 FOREIGN KEY (keys_id) REFERENCES keys(id),
  CONSTRAINT identity_providers_fk_2 FOREIGN KEY (reconcile_lambdas_id) REFERENCES lambdas(id)
);

CREATE TABLE identity_providers_applications (
  applications_id       UUID    NOT NULL,
  data                  TEXT    NOT NULL,
  enabled               BOOLEAN NOT NULL,
  identity_providers_id UUID    NOT NULL,
  keys_id               UUID    NULL,
  CONSTRAINT identity_providers_applications_fk_1 FOREIGN KEY (applications_id) REFERENCES applications(id),
  CONSTRAINT identity_providers_applications_fk_2 FOREIGN KEY (identity_providers_id) REFERENCES identity_providers(id),
  CONSTRAINT identity_providers_applications_fk_3 FOREIGN KEY (keys_id) REFERENCES keys(id)
);

CREATE TABLE federated_domains (
  identity_providers_id UUID         NOT NULL,
  domain                VARCHAR(191) NOT NULL,
  CONSTRAINT federated_domains_fk_1 FOREIGN KEY (identity_providers_id) REFERENCES identity_providers(id),
  CONSTRAINT federated_domains_uk_1 UNIQUE (domain)
);

-- Failed Logins
CREATE TABLE failed_logins (
  count               INTEGER NOT NULL,
  last_failed_instant BIGINT  NOT NULL,
  tenants_id          UUID    NOT NULL,
  users_id            UUID    NOT NULL,
  CONSTRAINT failed_logins_fk_1 FOREIGN KEY (users_id) REFERENCES users(id),
  CONSTRAINT failed_logins_fk_2 FOREIGN KEY (tenants_id) REFERENCES tenants(id),
  CONSTRAINT failed_logins_uk_1 UNIQUE (users_id)
);
CREATE INDEX failed_logins_i_1 ON failed_logins(tenants_id, last_failed_instant);

-- Nodes
CREATE TABLE nodes (
  id                   UUID         NOT NULL,
  insert_instant       BIGINT       NOT NULL,
  last_checkin_instant BIGINT       NOT NULL,
  runtime_mode         VARCHAR(255) NOT NULL,
  url                  VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
);

-- Identities
CREATE TABLE identities (
  id                                     BIGSERIAL,
  breached_password_last_checked_instant BIGINT       NULL,
  breached_password_status               SMALLINT     NULL,
  email                                  VARCHAR(191) NULL,
  encryption_scheme                      VARCHAR(255) NOT NULL,
  factor                                 INTEGER      NOT NULL,
  last_login_instant                     BIGINT       NULL,
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
  PRIMARY KEY (id),
  CONSTRAINT identities_uk_1 UNIQUE (email, tenants_id),
  CONSTRAINT identities_uk_2 UNIQUE (username_index, tenants_id),
  CONSTRAINT identities_fk_1 FOREIGN KEY (tenants_id) REFERENCES tenants(id),
  CONSTRAINT identities_fk_2 FOREIGN KEY (users_id) REFERENCES users(id)
);

CREATE INDEX identities_i_1 ON identities(users_id);

CREATE TABLE instance (
  id             UUID         NOT NULL,
  encryption_key VARCHAR(255) NULL,
  license_id     VARCHAR(255) NULL
);

-- Common breached passwords
CREATE TABLE common_breached_passwords (
  password VARCHAR(191) NOT NULL,
  PRIMARY KEY (password)
);

-- Data sets
CREATE TABLE data_sets (
  name                VARCHAR(191) NOT NULL,
  last_update_instant BIGINT       NOT NULL,
  PRIMARY KEY (name)
);

-- Breached Password Metrics
CREATE TABLE breached_password_metrics (
  tenants_id                    UUID NOT NULL,
  matched_exact_count           INT  NOT NULL,
  matched_sub_address_count     INT  NOT NULL,
  matched_common_password_count INT  NOT NULL,
  matched_password_count        INT  NOT NULL,
  passwords_checked_count       INT  NOT NULL,
  PRIMARY KEY (tenants_id),
  CONSTRAINT breached_password_metrics_fk_1 FOREIGN KEY (tenants_id) REFERENCES tenants(id)
);

--
-- Insert the initial data
--

INSERT INTO version(version)
  VALUES ('1.17.0');

-- Insert instance
INSERT INTO instance(id)
  VALUES (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID);

-- Insert locks
INSERT INTO locks(type)
  VALUES ('UserActionEndEvent'),
    ('Family'),
    ('com.inversoft.migration.Migrator'),
    ('Reindex');

-- Initial master record
INSERT INTO master_record(id, instant)
  VALUES ('00000000000000000000000000000000', 0);

-- Insert the default signing key and the 'shadow' client secret keys, increment insert_instant by 1 second each time to ensure order can be predicted
INSERT INTO keys (id, algorithm, insert_instant, kid, name, secret, type)
  VALUES (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, 'HS256', (EXTRACT(EPOCH FROM NOW()) + 1) * 1000, SUBSTRING(MD5(RANDOM() :: TEXT), 0, 10), 'Default signing key', ENCODE(
      DECODE(MD5(RANDOM() :: TEXT), 'hex') || DECODE(MD5(RANDOM() :: TEXT), 'hex'), 'base64'), 'HMAC'),
  ('092dbedc30af41499c61b578f2c72f59', 'HS256', (EXTRACT(EPOCH FROM NOW()) + 2) * 1000, SUBSTRING(MD5(RANDOM() :: TEXT), 0, 10), 'OpenID Connect compliant HMAC using SHA-256', NULL, 'HMAC'),
  ('4b8f1c06518e45bd9ac5d549686ae02a', 'HS384', (EXTRACT(EPOCH FROM NOW()) + 3) * 1000, SUBSTRING(MD5(RANDOM() :: TEXT), 0, 10), 'OpenID Connect compliant HMAC using SHA-384', NULL, 'HMAC'),
  ('c753a44d7f2e48d3bc4ec2c16488a23b', 'HS512', (EXTRACT(EPOCH FROM NOW()) + 4) * 1000, SUBSTRING(MD5(RANDOM() :: TEXT), 0, 10), 'OpenID Connect compliant HMAC using SHA-512', NULL, 'HMAC');

-- Insert default theme
INSERT INTO themes(id, insert_instant, last_update_instant, name, data)
  VALUES ('75a068fde94b451a9aeb3ddb9a3b5987', (EXTRACT(EPOCH FROM NOW()) + 5) * 1000, (EXTRACT(EPOCH FROM NOW()) + 1) * 1000, 'FusionAuth', '{}');

-- Insert default tenant
INSERT INTO tenants(id, data, name, access_token_signing_keys_id, id_token_signing_keys_id, themes_id)
  VALUES (MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID,
          '{' ||
          '"emailConfiguration": {"host": "localhost", "port": 25},' ||
          '"eventConfiguration": {},' ||
          '"externalIdentifierConfiguration": {"authorizationGrantIdTimeToLiveInSeconds": 30, "changePasswordIdTimeToLiveInSeconds": 600, "changePasswordIdGenerator": {"length": 32, "type": "randomBytes"}, "deviceCodeTimeToLiveInSeconds": 1800, "deviceUserCodeIdGenerator": {"length": 6, "type": "randomAlphaNumeric"}, "emailVerificationIdTimeToLiveInSeconds": 86400, "emailVerificationIdGenerator": {"length": 32, "type": "randomBytes"}, "externalAuthenticationIdTimeToLiveInSeconds": 300, "oneTimePasswordTimeToLiveInSeconds": 60, "passwordlessLoginTimeToLiveInSeconds": 180, "passwordlessLoginGenerator": {"length": 32, "type": "randomBytes"}, "registrationVerificationIdTimeToLiveInSeconds": 86400, "registrationVerificationIdGenerator": {"length": 32, "type": "randomBytes"}, "setupPasswordIdTimeToLiveInSeconds": 86400, "setupPasswordIdGenerator": {"length": 32, "type": "randomBytes"}, "twoFactorIdTimeToLiveInSeconds": 300, "twoFactorTrustIdTimeToLiveInSeconds": 2592000},' ||
          '"issuer": "acme.com",' ||
          '"jwtConfiguration": {"enabled": true, "timeToLiveInSeconds": 3600, "refreshTokenExpirationPolicy": "Fixed", "refreshTokenTimeToLiveInMinutes": 43200, "refreshTokenUsagePolicy": "Reusable"},' ||
          '"passwordEncryptionConfiguration": {"encryptionScheme": "salted-pbkdf2-hmac-sha256", "encryptionSchemeFactor": 24000, "modifyEncryptionSchemeOnLogin": false},' ||
          '"passwordValidationRules": {"maxLength": 256, "minLength": 8, "requireMixedCase": false, "requireNonAlpha": false}' ||
          '}',
          'Default',
          (SELECT id FROM keys WHERE name = 'Default signing key' LIMIT 1),
          '092dbedc30af41499c61b578f2c72f59',
          '75a068fde94b451a9aeb3ddb9a3b5987');

-- Insert the applications
INSERT INTO applications(name, active, id, data, tenants_id)
  VALUES ('FusionAuth',
          TRUE,
          '3c219e58ed0e4b18ad48f4f92793ae32',
          '{"oauthConfiguration": {"authorizedRedirectURLs": ["/login"], "clientId": "3c219e58-ed0e-4b18-ad48-f4f92793ae32", "clientSecret": "' ||
          REPLACE(
              ENCODE(
                    MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: BYTEA ||
                    MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: BYTEA,
                    'base64'), E'\n', '') ||
          '", "enabledGrants": ["authorization_code"], "logoutURL": "/", "generateRefreshTokens": false, "requireClientAuthentication": true}, ' ||
          '"loginConfiguration": {"allowTokenRefresh": false, "generateRefreshTokens": false, "requireAuthentication": true}}',
          (SELECT id FROM tenants LIMIT 1));

-- Insert the roles
INSERT INTO application_roles(id, applications_id, is_default, is_super_role, name, description)
  VALUES ('631ecd9d8d404c13827780cedb8236e2', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, TRUE, 'admin', 'Global admin'),
  ('631ecd9d8d404c13827780cedb8236e3', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'api_key_manager', 'API key manager'),
  ('631ecd9d8d404c13827780cedb8236e4', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'application_deleter', 'Application deleter'),
  ('631ecd9d8d404c13827780cedb8236e5', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'application_manager', 'Application manager'),
  ('631ecd9d8d404c13827780cedb8236e6', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'audit_log_viewer', 'Audit log viewer'),
  ('631ecd9d8d404c13827780cedb8236e7', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'email_template_manager', 'Email template manager'),
  ('631ecd9d8d404c13827780cedb8236e8', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'report_viewer', 'Report viewer'),
  ('631ecd9d8d404c13827780cedb8236e9', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'system_manager', 'System configuration manager'),
  ('631ecd9d8d404c13827780cedb8236f0', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'user_action_deleter', 'User action deleter'),
  ('631ecd9d8d404c13827780cedb8236f1', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'user_action_manager', 'User action manager'),
  ('631ecd9d8d404c13827780cedb8236f2', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'user_deleter', 'User deleter'),
  ('631ecd9d8d404c13827780cedb8236f3', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'user_manager', 'User manager'),
  ('631ecd9d8d404c13827780cedb8236f4', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'webhook_manager', 'Webhook manager'),
  ('631ecd9d8d404c13827780cedb8236f5', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'group_manager', 'Group manager'),
  ('631ecd9d8d404c13827780cedb8236f6', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'group_deleter', 'Group deleter'),
  ('631ecd9d8d404c13827780cedb8236f7', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'tenant_manager', 'Tenant manager'),
  ('631ecd9d8d404c13827780cedb8236f8', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'tenant_deleter', 'Tenant deleter'),
  ('631ecd9d8d404c13827780cedb8236f9', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'lambda_manager', 'Lambda manager'),
  ('631ecd9d8d404c13827780cedb8236fa', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'event_log_viewer', 'Event log viewer'),
  ('631ecd9d8d404c13827780cedb8236fb', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'key_manager', 'Key manager'),
  ('631ecd9d8d404c13827780cedb8236fc', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'consent_deleter', 'Consent deleter'),
  ('631ecd9d8d404c13827780cedb8236fd', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'consent_manager', 'Consent manager'),
  ('631ecd9d8d404c13827780cedb8236fe', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'theme_manager', 'Theme manager'),
  ('631ecd9d8d404c13827780cedb8236ff', '3c219e58ed0e4b18ad48f4f92793ae32', FALSE, FALSE, 'reactor_manager', 'Reactor manager');

-- System configuration
INSERT INTO system_configuration(data, report_timezone)
  VALUES ('{}', 'America/Denver');

-- Internal API key, replace new lines with empty
INSERT INTO authentication_keys(id, permissions, meta_data, tenants_id)
  VALUES ('__internal_' || REPLACE(ENCODE(MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: BYTEA ||
                                          MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: BYTEA, 'base64'), E'\n', ''),
          '{"endpoints": {"/api/cache/reload": ["POST"], "/api/system/log/export": ["POST"]}}',
          '{"attributes": {"description": "Internal Use Only. [DistributedCacheNotifier][DistributedLogDownloader]", "internalCacheReloader": "true", "internalLogDownloader": "true"}}',
          NULL);

-- Integrations
INSERT INTO integrations(data)
  VALUES ('{}');

-- Initialize the version of the BreachPasswords data set
INSERT INTO data_sets (name, last_update_instant)
  VALUES ('BreachPasswords', 1581476456155);


-- Default IdP Lambdas

-- OpenIDReconcile (1)
INSERT INTO lambdas (id, debug, name, type, body, enabled, insert_instant) VALUES(MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, false, 'Default OpenID Connect Reconcile provided by FusionAuth', 1, '
// This is the default OpenID Connect reconcile, modify this to your liking.
function reconcile(user, registration, jwt) {

  // Un-comment this line to see the jwt object printed to the event log
  // console.info(JSON.stringify(jwt, null, '' ''));

  user.firstName = jwt.given_name;
  user.middleName = jwt.middle_name;
  user.lastName = jwt.family_name;
  user.fullName = jwt.name;
  user.imageUrl = jwt.picture;
  user.mobilePhone = jwt.phone_number;

  // https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
  if (jwt.birthdate && jwt.birthdate != ''0000'') {
    if (jwt.birthdate.length == 4) {
       // Only a year was provided, set to January 1.
       user.birthDate = jwt.birthdate + ''-01-01'';
    } else {
      user.birthDate = jwt.birthdate;
    }
  }

  // https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
  if (jwt.locale) {
    user.preferredLanguages = user.preferredLanguages || [];
    // Replace the dash with an under score.
    user.preferredLanguages.push(jwt.locale.replace(''-'', ''_''));
  }

  // Set preferred_username in registration.
  // - This is just for display purposes, this value cannot be used to uniquely identify
  //   the user in FusionAuth.
  registration.username = jwt.preferred_username;

}', true, (EXTRACT(EPOCH FROM NOW()) + 5) * 1000);

-- Migrate all OpenID Connect IdPs that do not currently have a lambda select to use this one.
UPDATE identity_providers SET reconcile_lambdas_id = (SELECT id FROM lambdas WHERE name = 'Default OpenID Connect Reconcile provided by FusionAuth' LIMIT 1) WHERE type = 'OpenIDConnect' AND reconcile_lambdas_id IS NULL;

-- SAMLv2Reconcile (2)
INSERT INTO lambdas (id, debug, name, type, body, enabled, insert_instant) VALUES(MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, false, 'Default SAML v2 Reconcile provided by FusionAuth', 2, '
// This is the default SAML v2 reconcile, modify this to your liking.
function reconcile(user, registration, samlResponse) {

  // Un-comment this line to see the samlResponse object printed to the event log
  // console.info(JSON.stringify(samlResponse, null, '' ''));

  var getAttribute = function(samlResponse, attribute) {
    var values = samlResponse.assertion.attributes[attribute];
    if (values && values.length > 0) {
      return values[0];
    }

    return null;
  };

  // Retrieve an attribute from the samlResponse
  // - Arguments [2 .. ] provide a preferred order of attribute names to lookup the value in the response.
  var defaultIfNull = function(samlResponse) {
    for (var i=1; i < arguments.length; i++) {
      var value = getAttribute(samlResponse, arguments[i]);
      if (value !== null) {
        return value;
      }
    }
  };

  user.birthDate = defaultIfNull(samlResponse, ''http://schemas.xmlsoap.org/ws/2005/05/identity/claims/dateofbirth'', ''birthdate'', ''date_of_birth'');
  user.firstName = defaultIfNull(samlResponse, ''http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'', ''first_name'');
  user.lastName = defaultIfNull(samlResponse, ''http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'', ''last_name'');
  user.fullName = defaultIfNull(samlResponse, ''http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'', ''name'', ''full_name'');
  user.mobilePhone = defaultIfNull(samlResponse, ''http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'', ''mobile_phone'');

}', true, (EXTRACT(EPOCH FROM NOW()) + 5) * 1000);

-- Migrate all SAML v2 IdPs that do not currently have a lambda select to use this one.
UPDATE identity_providers SET reconcile_lambdas_id = (SELECT id FROM lambdas WHERE name = 'Default SAML v2 Reconcile provided by FusionAuth' LIMIT 1) WHERE type = 'SAMLv2' AND reconcile_lambdas_id IS NULL;

-- AppleReconcile (4)
INSERT INTO lambdas (id, debug, name, type, body, enabled, insert_instant) VALUES(MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, false, 'Default Apple Reconcile provided by FusionAuth', 4, '
// This is the default Apple reconcile, modify this to your liking.
function reconcile(user, registration, idToken) {

  // Un-comment this line to see the idToken object printed to the event log
  // console.info(JSON.stringify(idToken, null, '' ''));

  // During the first login attempt, the user object will be available which may contain first and last name.
  if (idToken.user && idToken.user.name) {
    user.firstName = idToken.user.name.firstName || user.firstName;
    user.lastName = idToken.user.name.lastName || user.lastName;
  }

}', true, (EXTRACT(EPOCH FROM NOW()) + 5) * 1000);

-- Migrate the Apple IdP (if configured) to use this lambda.
UPDATE identity_providers SET reconcile_lambdas_id = (SELECT id FROM lambdas WHERE type = 4 LIMIT 1) WHERE type = 'Apple';

-- FacebookReconcile (6)
INSERT INTO lambdas (id, debug, name, type, body, enabled, insert_instant) VALUES(MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, false, 'Default Facebook Reconcile provided by FusionAuth', 6, '
// This is the default Facebook reconcile, modify this to your liking.
function reconcile(user, registration, facebookUser) {

  // Un-comment this line to see the facebookUser object printed to the event log
  // console.info(JSON.stringify(facebookUser, null, '' ''));

  user.firstName = facebookUser.first_name;
  user.middleName = facebookUser.middle_name;
  user.lastName = facebookUser.last_name;
  user.fullName = facebookUser.name;

  if (facebookUser.picture && !facebookUser.picture.data.is_silhouette) {
    user.imageUrl = facebookUser.picture.data.url;
  }

  if (facebookUser.birthday) {
    // Convert MM/dd/yyyy -> YYYY-MM-DD
    var parts = facebookUser.birthday.split(''/'');
    user.birthDate = parts[2] + ''-'' +  parts[0] + ''-'' +  parts[1];
  }

}', true, (EXTRACT(EPOCH FROM NOW()) + 5) * 1000);

-- Migrate the Facebook IdP (if configured) to use this lambda.
UPDATE identity_providers SET reconcile_lambdas_id = (SELECT id FROM lambdas WHERE type = 6 LIMIT 1) WHERE type = 'Facebook';

-- GoogleReconcile (7)
INSERT INTO lambdas (id, debug, name, type, body, enabled, insert_instant) VALUES(MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, false, 'Default Google Reconcile provided by FusionAuth', 7, '
// This is the default Google reconcile, modify this to your liking.
function reconcile(user, registration, idToken) {

  // Un-comment this line to see the idToken object printed to the event log
  // console.info(JSON.stringify(idToken, null, '' ''));

  // The idToken is the response from the tokeninfo endpoint
  // https://developers.google.com/identity/sign-in/web/backend-auth#calling-the-tokeninfo-endpoint
  user.firstName = idToken.given_name;
  user.lastName = idToken.family_name;
  user.fullName = idToken.name;
  user.imageUrl = idToken.picture;

}', true, (EXTRACT(EPOCH FROM NOW()) + 5) * 1000);

-- Migrate the Google IdP (if configured) to use this lambda.
UPDATE identity_providers SET reconcile_lambdas_id = (SELECT id FROM lambdas WHERE type = 7 LIMIT 1) WHERE type = 'Google';

-- TwitterReconcile (9)
INSERT INTO lambdas (id, debug, name, type, body, enabled, insert_instant) VALUES(MD5(RANDOM() :: TEXT || CLOCK_TIMESTAMP() :: TEXT) :: UUID, false, 'Default Twitter Reconcile provided by FusionAuth', 9, '
// This is the default Twitter reconcile, modify this to your liking.
function reconcile(user, registration, twitterUser) {

  // Un-comment this line to see the twitterUser object printed to the event log
  // console.info(JSON.stringify(twitterUser, null, '' ''));

  // Set name if available in the response
  if (twitterUser.name) {
    user.fullName = twitterUser.name;
  }

  // https://developer.twitter.com/en/docs/accounts-and-users/user-profile-images-and-banners.html
  if (twitterUser.profile_image_url_https) {
    // Remove the _normal suffix to get the original size.
    user.imageUrl = twitterUser.profile_image_url_https.replace(''_normal.png'', ''.png'');
  }

  // Set twitter screen_name in registration.
  // - This is just for display purposes, this value cannot be used to uniquely identify
  //   the user in FusionAuth.
  registration.username = twitterUser.screen_name;
}', true, (EXTRACT(EPOCH FROM NOW()) + 5) * 1000);

-- Migrate the Twitter IdP (if configured to use this lambda.
UPDATE identity_providers SET reconcile_lambdas_id = (SELECT id FROM lambdas WHERE type = 9 LIMIT 1) WHERE type = 'Twitter';
