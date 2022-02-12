import SlackNotify from 'slack-notify';
import { DeleteResult } from './types';
const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';
const channel = '#auth0-notifications';

export interface SlackResponse {
  ok: true;
  channel: string;
  ts: string; // transaction id, aka message id
}

export async function sendInactiveUserWarning(numUsersNotified: number): Promise<SlackResponse> {
  const slack = SlackNotify(SLACK_WEBHOOK_URL);
  return await slack.alert({
    channel,
    text: `${numUsersNotified} users were notified of future account deletion.`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Users notified of account deletion :sob:`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${numUsersNotified} users were notified of future account deletion.*`,
        },
      },
    ],
  });
}

export async function accountDeletionInitialNotification(results: DeleteResult[]): Promise<SlackResponse> {
  const slack = SlackNotify(SLACK_WEBHOOK_URL);

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:skull_and_crossbones: ${results.length} Inactive users deleted :skull_and_crossbones:`,
        emoji: true,
      },
    },
    {
      type: 'divider',
    },
  ];

  results.forEach((result) => {
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Auth0 Id:*\n${result.auth0Id}`,
        },
        {
          type: 'mrkdwn',
          text: `*Local Database Id:*\n${result.localDatabaseId}`,
        },
        {
          type: 'mrkdwn',
          text: `*auth0Success:*\n${result.auth0Success}`,
        },
        {
          type: 'mrkdwn',
          text: `*Local Delete Success:*\n${result.localDeleteSuccess}`,
        },
        {
          type: 'mrkdwn',
          text: `*Org Count:*\n${result.orgCount}`,
        },
      ],
    });
    blocks.push({
      type: 'divider',
    });
  });

  return await slack.alert({
    channel,
    text: `${results.length} inactive users have been deleted.`,
    blocks,
  });
}
