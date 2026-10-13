// Scheduled ingestion (every 3 hours). Runs separately from the dashboard request path.
import { runIngest } from './lib/ingest.mjs';

export default async () => {
  const result = await runIngest({});
  console.log('threat-ingest', JSON.stringify(result));
};

export const config = { schedule: '0 */3 * * *' };
