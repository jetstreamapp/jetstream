---
id: platform-events
title: Platform Events
sidebar_label: Platform Events
slug: /developer/platform-events
---

The Platform Event page allows you to subscribe to or publish Platform Events.

## Subscribing

Choose the event you want to subscribe to and click subscribe.

You can also adjust the **Replay Id** to choose where you want to start receiving events. Refer to the Salesforce documentation for more information.

If you leave the page, Jetstream will automatically unsubscribe from the event, so if you want to continue receiving events you will need to leave the tab open.

:::tip

Use -2 in the replay id to see all the events emitted in the last 24 hours.

:::

## Publishing

Choose the platform event you wnt to publish and you will be presented with a form of all the fields configured for the event.

Fill in the required fields, at a minimum, and click publish.

:::tip

You can subscribe to an event and publish records for the same event to see how external systems would receive the events.

:::

<img src={require('./platform-events.png').default} alt="Platform event page screenshot" />
