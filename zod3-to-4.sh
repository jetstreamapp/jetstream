#!/bin/bash

# Zod v3 to v4 Migration Script
# This script runs the zod-v3-to-v4 migration tool on all tsconfig.json files

set -e  # Exit on error

echo "Starting Zod v3 to v4 migration..."
echo "================================="

# Apps
npx zod-v3-to-v4 apps/api/tsconfig.json
npx zod-v3-to-v4 apps/cron-tasks/tsconfig.json
npx zod-v3-to-v4 apps/docs/tsconfig.json
npx zod-v3-to-v4 apps/download-zip-sw/tsconfig.json
npx zod-v3-to-v4 apps/geo-ip-api/tsconfig.json
npx zod-v3-to-v4 apps/jetstream-desktop-client-e2e/tsconfig.json
npx zod-v3-to-v4 apps/jetstream-desktop-client/tsconfig.json
npx zod-v3-to-v4 apps/jetstream-desktop/tsconfig.json
npx zod-v3-to-v4 apps/jetstream-e2e/tsconfig.json
npx zod-v3-to-v4 apps/jetstream-web-extension-e2e/tsconfig.json
npx zod-v3-to-v4 apps/jetstream-web-extension/tsconfig.json
npx zod-v3-to-v4 apps/jetstream-worker/tsconfig.json
npx zod-v3-to-v4 apps/jetstream/tsconfig.json
npx zod-v3-to-v4 apps/landing/tsconfig.json

# Libs
npx zod-v3-to-v4 libs/api-config/tsconfig.json
npx zod-v3-to-v4 libs/api-logger/tsconfig.json
npx zod-v3-to-v4 libs/api-types/tsconfig.json
npx zod-v3-to-v4 libs/auth/acl/tsconfig.json
npx zod-v3-to-v4 libs/auth/server/tsconfig.json
npx zod-v3-to-v4 libs/auth/types/tsconfig.json
npx zod-v3-to-v4 libs/connected/connected-ui/tsconfig.json
npx zod-v3-to-v4 libs/desktop-types/tsconfig.json
npx zod-v3-to-v4 libs/email/tsconfig.json
npx zod-v3-to-v4 libs/features/anon-apex/tsconfig.json
npx zod-v3-to-v4 libs/features/automation-control/tsconfig.json
npx zod-v3-to-v4 libs/features/create-object-and-fields/tsconfig.json
npx zod-v3-to-v4 libs/features/create-records/tsconfig.json
npx zod-v3-to-v4 libs/features/debug-log-viewer/tsconfig.json
npx zod-v3-to-v4 libs/features/deploy/tsconfig.json
npx zod-v3-to-v4 libs/features/formula-evaluator/tsconfig.json
npx zod-v3-to-v4 libs/features/load-records-multi-object/tsconfig.json
npx zod-v3-to-v4 libs/features/load-records/tsconfig.json
npx zod-v3-to-v4 libs/features/manage-permissions/tsconfig.json
npx zod-v3-to-v4 libs/features/organizations/tsconfig.json
npx zod-v3-to-v4 libs/features/platform-event-monitor/tsconfig.json
npx zod-v3-to-v4 libs/features/query/tsconfig.json
npx zod-v3-to-v4 libs/features/record-type-manager/tsconfig.json
npx zod-v3-to-v4 libs/features/salesforce-api/tsconfig.json
npx zod-v3-to-v4 libs/features/sobject-export/tsconfig.json
npx zod-v3-to-v4 libs/features/teams/tsconfig.json
npx zod-v3-to-v4 libs/features/update-records/tsconfig.json
npx zod-v3-to-v4 libs/icon-factory/tsconfig.json
npx zod-v3-to-v4 libs/monaco-configuration/tsconfig.json
npx zod-v3-to-v4 libs/prisma/tsconfig.json
npx zod-v3-to-v4 libs/salesforce-api/tsconfig.json
npx zod-v3-to-v4 libs/shared/browser-worker-utils/tsconfig.json
npx zod-v3-to-v4 libs/shared/client-logger/tsconfig.json
npx zod-v3-to-v4 libs/shared/constants/tsconfig.json
npx zod-v3-to-v4 libs/shared/data/tsconfig.json
npx zod-v3-to-v4 libs/shared/node-utils/tsconfig.json
npx zod-v3-to-v4 libs/shared/ui-app-state/tsconfig.json
npx zod-v3-to-v4 libs/shared/ui-core-shared/tsconfig.json
npx zod-v3-to-v4 libs/shared/ui-core/tsconfig.json
npx zod-v3-to-v4 libs/shared/ui-db/tsconfig.json
npx zod-v3-to-v4 libs/shared/ui-record-form/tsconfig.json
npx zod-v3-to-v4 libs/shared/ui-router/tsconfig.json
npx zod-v3-to-v4 libs/shared/ui-utils/tsconfig.json
npx zod-v3-to-v4 libs/shared/utils/tsconfig.json
npx zod-v3-to-v4 libs/splitjs/tsconfig.json
npx zod-v3-to-v4 libs/test/e2e-utils/tsconfig.json
npx zod-v3-to-v4 libs/types/tsconfig.json
npx zod-v3-to-v4 libs/ui/tsconfig.json

echo ""
echo "================================="
echo "Migration complete!"
