import { INDEXED_DB } from '@jetstream/shared/constants';
import { ApexHistoryItem, MapOf, QueryHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import JSZip from 'jszip';
import localforage from 'localforage';

interface ExportHistory {
  queryHistory: QueryHistoryItem[];
  apexHistory: ApexHistoryItem[];
  // deployHistory: SalesforceDeployHistoryItem[];
  // loadSavedMapping: LoadSavedMappingItem[];
}

export async function exportOrgHistory(org: SalesforceOrgUi): Promise<ExportHistory> {
  // TODO: maybe allow user to limit what is exported
  const [queryHistory, apexHistory] = await Promise.all([
    localforage
      .getItem<MapOf<QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory)
      .then((history) => Object.values(history || {}).filter((item) => item.org === org.uniqueId)),
    localforage
      .getItem<MapOf<ApexHistoryItem>>(INDEXED_DB.KEYS.apexHistory)
      .then((history) => Object.values(history || {}).filter((item) => item.org === org.uniqueId)),
  ]);

  return {
    queryHistory,
    apexHistory,
  };
}

export async function generateHistoryFile(org: SalesforceOrgUi, history: ExportHistory) {
  const zip = new JSZip();
  zip.file(`query/all-queries.json`, JSON.stringify(history.queryHistory, null, 2));
  zip.file(
    `query/all-queries.soql`,
    history.queryHistory.map((item) => `**************** Last Run: ${item.lastRun} ****************\n\n${item.soql}`).join('\n\n')
  );

  zip.file(`apex/all-apex.json`, JSON.stringify(history.apexHistory, null, 2));
  history.apexHistory.forEach((item) => {
    zip.file(`apex/${item.lastRun.getTime()}.apex`, item.apex);
  });

  zip.file(
    `README.md`,
    `## History Export

exported at: ${new Date()}
org id: ${org.organizationId}
username: ${org.username} (${org.userId})
instance: ${org.instanceUrl}

Apex    ${history.apexHistory.length}
Queries ${history.queryHistory.length}
`
  );

  const file = await zip.generateAsync({ type: 'arraybuffer' });

  return file;
}

export async function processHistoryFile(org: SalesforceOrgUi, file: ArrayBuffer): Promise<ExportHistory> {
  const output: ExportHistory = {
    queryHistory: [],
    apexHistory: [],
  };

  const zip = await JSZip.loadAsync(file);

  const queryFile = zip.file('query/all-queries.json');
  if (queryFile) {
    // TODO: validate data is in correct format
    const queryHistory: QueryHistoryItem[] = JSON.parse(await queryFile.async('string'));
    queryHistory.forEach((item) => {
      item.key = item.key.replace(item.org, org.uniqueId);
      item.org = org.uniqueId;
      output.queryHistory.push(item);
    });
  }

  const apexFile = zip.file('apex/all-apex.json');
  if (apexFile) {
    // TODO: validate data is in correct format
    const apexHistory: ApexHistoryItem[] = JSON.parse(await apexFile.async('string'));
    apexHistory.forEach((item) => {
      item.key = item.key.replace(item.org, org.uniqueId);
      item.org = org.uniqueId;
      output.apexHistory.push(item);
    });
  }

  return output;
}
