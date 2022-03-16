import { ENV } from '@jetstream/api-config';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: ENV.GITHUB_TOKEN,
});

export async function createIssue(
  title: string,
  body: string,
  labels: string[] = [':ambulance: needs triage', ':superhero: user-submitted']
) {
  return await octokit.issues.create({
    owner: 'paustint',
    repo: 'jetstream',
    title,
    body,
    assignee: 'paustint',
    labels,
  });
}
