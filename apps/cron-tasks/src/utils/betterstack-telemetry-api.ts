import axios from 'axios';
import { format } from 'date-fns';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';
import { DailyEventCounts } from './types';

/**
 * Better Stack RUM analytics events for the web app (application "Jetstream Frontend") land in the
 * team's ClickHouse telemetry source. Historical data (everything older than ~30 minutes) lives in
 * S3-backed cold storage, discriminated by `_row_type` (5 = custom events). The full event is a JSON
 * document in the `raw` column.
 *
 * Queries run over the ClickHouse HTTP interface using the "Connect remotely" credentials from the
 * Better Stack dashboard (Telemetry -> Cloud connections).
 */
const EVENTS_COLLECTION = `s3Cluster(primary, t316033_logs_us_2_s3)`;
const CUSTOM_EVENT_ROW_TYPE = 5;

const LOAD_EVENT = 'load_Submitted';
const QUERY_EVENT = 'query_ExecuteQuery';

interface DailyEventCountRow {
  date: string;
  loadRecords: string | number;
  queryCount: string | number;
}

/**
 * Daily totals for the public usage stats: records loaded (sum of the `numRecords` property on
 * load_Submitted events) and queries executed (count of query_ExecuteQuery events).
 * Both bounds are inclusive and interpreted as full UTC days.
 */
export async function queryDailyEventCounts({ startDate, endDate }: { startDate: Date; endDate: Date }): Promise<DailyEventCounts[]> {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');
  logger.info(`queryDailyEventCounts: ${start} - ${end}`);

  const sql = `
    SELECT
      toDate(dt) AS date,
      toInt64(sumIf(coalesce(JSONExtract(raw, 'payload', 'numRecords', 'Nullable(Int64)'), 0), JSONExtractString(raw, 'event') = '${LOAD_EVENT}')) AS loadRecords,
      toInt64(countIf(JSONExtractString(raw, 'event') = '${QUERY_EVENT}')) AS queryCount
    FROM ${EVENTS_COLLECTION}
    WHERE
      _row_type = ${CUSTOM_EVENT_ROW_TYPE}
      AND dt >= toDateTime('${start} 00:00:00')
      AND dt < toDateTime('${end} 00:00:00') + INTERVAL 1 DAY
      AND JSONExtractString(raw, 'event') IN ('${LOAD_EVENT}', '${QUERY_EVENT}')
    GROUP BY date
    ORDER BY date
    FORMAT JSONEachRow
  `;

  const response = await axios.post<string>(ENV.BETTERSTACK_QUERY_HOST as string, sql, {
    auth: {
      username: ENV.BETTERSTACK_QUERY_USERNAME as string,
      password: ENV.BETTERSTACK_QUERY_PASSWORD as string,
    },
    headers: { 'Content-Type': 'text/plain' },
    // ClickHouse returns newline-delimited JSON rows; keep the raw string and parse below
    transformResponse: (data) => data,
  });

  return String(response.data)
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as DailyEventCountRow)
    .map(({ date, loadRecords, queryCount }) => ({
      date,
      loadRecords: Number(loadRecords),
      queryCount: Number(queryCount),
    }));
}
