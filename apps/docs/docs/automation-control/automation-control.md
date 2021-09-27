---
id: automation-control
title: Automation Control
sidebar_label: Automation Control
slug: /automation-control
---

import SearchIcon from '../assets/icons/Search.svg';

Automation Control allows you to quickly disable or enable automation in your org with the option to easily rollback your changes.

**The following automation is supported**:

- Validation Rules
- Workflow Rules
- Process Builders
- Record Triggered Flows
- Apex Triggers
  - _Apex triggers are not supported in production orgs because of Salesforce code coverage requirements_

<img src={require('./automation-control-overview.png').default} alt="Automation control overview" />

## Toggling automation

You can easily toggle your automation on and off prior to making in Changes in Salesforce.

For Process Builders and Record Triggered Flows, you will need to choose the version that you want to activate or deactivate. Only one version can be active at any given time.

For Validation Rules and Workflow Rules, you can hover over the magnifying glass icon <SearchIcon className="icon inline" /> to see additional information about the rule.

:::tip

Before you make any changes, click **export** to download the current state of your automation in case you need to refer back to the current state of your automation.

:::

Pending changes are highlighted in yellow.

<img src={require('./automation-control-pending-changes-1.png').default} alt="Automation control pending changes" />

## Rolling back automation

After you click **Preview Changes**, you will again see a summary of the pending changes. After you deploy changes, you are shown the results and any error messages if the toggle failed for any individual items.

Once the deployment is processed, you have the option to rollback your changes. If you close the modal, you will no longer have the option to rollback.

:::tip

After deploying your automation, leave the browser tab and the modal window open so you can easily rollback your changes.

:::

<img src={require('./automation-control-pending-changes-2.png').default} alt="Automation control pending changes modal" />

<img src={require('./automation-control-rollback.png').default} alt="Automation control pending changes modal" />
