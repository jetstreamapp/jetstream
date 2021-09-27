---
id: getting-started
title: Getting Started
sidebar_label: Getting Started
slug: /
---

import OrgTroubleshootingTable from './\_org-troubleshooting-table.mdx';

Jetstream is the **swiss army knife** of working with and administering Salesforce. We know that once you start using Jetstream, you'll wonder how you ever got on without it.

If you have questions or want to talk with a human, you can reach support by emailing [support@getjetstream.app](mailto:support@getjetstream.app).

:::tip

If you haven't created a Jetstream account, you can [sign-up here](https://getjetstream.app/oauth/signup).

:::

## Adding your first org

After logging in to Jetstream for the first time, the first thing you need to do is connect Jetstream to one or more of your Salesforce orgs.

Jetstream uses OAuth2 for org connections, which means that Jetstream never gains access directly to your password,

To add an org, click the <button className="button button--link">+ Add Org</button> button at the top of the page.

You will be asked to choose an org type, this determines which Salesforce login url you will be redirected

- **Production / Developer**
- **Sandbox**
- **Pre-release**
- **Custom Login URL**

You will be redirected to Salesforce to login, then will be redirected back to Jetstream and your org will be connected.

### Troubleshooting Tips

<OrgTroubleshootingTable />
