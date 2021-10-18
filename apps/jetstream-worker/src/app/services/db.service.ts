// import { DB, Jobs } from '@jetstream/types';
import { QueryResultRow } from 'pg';
import { pool } from '../config/db.config';
// import type { ScheduledExport } from '@prisma/client';
/**
 * https://node-postgres.com/features/queries
 */
// function query<T>(queryText: string, values: any[]) {
//   return new Promise((resolve: (value: T[]) => void, reject) => {
//     pool.connect().then((client) =>
//       client
//         .query<T>(queryText, values)
//         .then((res) => {
//           client.release();
//           resolve(res.rows);
//         })
//         .catch((err) => {
//           client.release();
//           reject(err);
//         })
//     );
//   });
// }

// export async function fetchScheduledJob({ userId, salesforceOrgId }: Jobs.ScheduledExport): Promise<DB.ScheduledJobWithOrg[]> {
//   return await query<DB.ScheduledJobWithOrg>(
//     `
//     SELECT "scheduled_export"."id", "scheduled_export"."userId", "scheduled_export"."salesforceOrgId",
//       "scheduled_export"."reportErrorsTo", "scheduled_export"."sendTo",
//       "salesforce_org"."accessToken", "salesforce_org"."apiVersion", "salesforce_org"."loginUrl",
//       "salesforce_org"."instanceUrl", "salesforce_org"."orgNamespacePrefix"
//     FROM "scheduled_export"
//     INNER JOIN "salesforce_org" ON ("scheduled_export"."salesforceOrgId" = "salesforce_org"."id")
//     WHERE (
//       "scheduled_export"."userId" = $1
//       AND "scheduled_export"."salesforceOrgId" = $2
//     )
//     LIMIT 1
//     `,
//     [userId, salesforceOrgId]
//   );
// }
