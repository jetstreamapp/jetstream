---
id: platform-events
title: Platform Events
description: Subscribe to and publish Salesforce Platform Events using Jetstream.
keywords: [
    salesforce,
    salesforce admin,
    salesforce developer,
    salesforce automation,
    salesforce workbench
    platform events,
    subscribe,
    publish platform event,
    publish event,
  ]
sidebar_label: Platform Events
slug: /developer/platform-events
---

The Platform Event page allows you to subscribe to or publish Platform Events.

## Subscribing

Choose the event you want to subscribe to and click subscribe. You can subscribe to many platform events at once.

You can also adjust the **Replay Id** to choose where you want to start receiving events. Refer to the Salesforce documentation for more information.

If you leave the page, Jetstream will automatically unsubscribe from any subscribed to events.

:::tip

Use -2 in the replay id to see all the events emitted in the last 24 hours.

:::

:::info

If you subscribe to Platform Events with very high volume, you may experience poor browser performance.

:::

## Publishing

Choose the platform event you want to publish and you will be presented with a form of all the fields configured for the event.

Fill in at least the required fields and click **Publish**.

:::tip

You can subscribe to an event and publish records for the same event to see how external systems would receive the events.

:::

<img src={require('./platform-events.png').default} alt="Platform event page screenshot" />
