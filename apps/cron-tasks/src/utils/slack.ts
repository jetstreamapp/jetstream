import SlackNotify from 'slack-notify';
const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';
const channel = '#auth0-notifications';

export function sendInactiveUserWarning(numUsersNotified: number) {
  const slack = SlackNotify(SLACK_WEBHOOK_URL);
  slack.alert({
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
