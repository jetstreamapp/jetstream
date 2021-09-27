---
id: automation-control
title: Automation Control
sidebar_label: Automation Control
slug: /automation-control
---

Automation Control allows you to quickly disable or enable automation in your org with the option to easily roll-back your changes.

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

For Validation Rules and Workflow Rules, you can hover over the magnifying glass to see additional information about the rule.

:::tip

Before you make any changes, click **export** to download the current state of your automation in case you need to refer back to the current state.

:::

You will see that pending changes show up with a yellow highlight.

<img src={require('./automation-control-pending-changes-1.png').default} alt="Automation control pending changes" />

## Rolling back automation

After you click preview changes, you will again see a summary of the pending changes. After you deploy changes, you are shown the results and any error messages if the toggle failed.

Once the rollback is processed, you have the option to rollback your changes. If you close the modal, you will no longer have the option to roll back.

:::tip

After toggle automation on or off, stay on this page and leave the browser tab open so you can easily roll back your changes.

:::

<img src={require('./automation-control-pending-changes-2.png').default} alt="Automation control pending changes modal" />

<img src={require('./automation-control-rollback.png').default} alt="Automation control pending changes modal" />
