import axios from 'axios';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';
import { AmplitudeChartResult } from './types';

const axiosAuth0 = axios.create({
  baseURL: `https://amplitude.com/api/3`,
});

const BASIC_AUTH_HEADER = `Basic ${Buffer.from(`${ENV.AMPLITUDE_API_KEY}:${ENV.AMPLITUDE_SECRET_KEY}`).toString('base64')}`;

export async function getAmplitudeChart(chartId: string) {
  logger.info(`getAmplitudeChart: ${chartId}`);
  return await axiosAuth0
    .get<AmplitudeChartResult>(`/chart/${chartId}/query`, {
      headers: {
        Authorization: BASIC_AUTH_HEADER,
      },
    })
    .then((result) => result.data);
}
