#!/bin/sh
# -e Exit immediately when a command returns a non-zero status.
# -x Print commands before they are executed
set -ex
# Seeding command
# psql prisma/seed-salesforce-api.sql
psql postgres < prisma/seed-salesforce-api.sql
