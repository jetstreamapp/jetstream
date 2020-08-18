\set ON_ERROR_STOP true

-- Fix the sequence on identities from 1.18.0 migration.
SELECT SETVAL('identities_id_seq', MAX(id)) FROM identities;

-- Update the version
UPDATE version
SET version = '1.18.2';