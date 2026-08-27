/// <reference types="vite/client" />
import { BetterStackCommand, BetterStackTag } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useEffect } from 'react';

/**
 * Injects the Better Stack RUM tag (remote script) once the user has accepted analytics cookies.
 *
 * IMPORTANT: This module must stay in the WEB APP and never move into a shared lib. Browser
 * extension stores reject bundles containing remote-script loading (even on unreachable code
 * paths), so the shared analytics module (@jetstream/ui-core analytics.tsx) only talks to
 * `window.betterstack` if it exists - creating it, and loading b.js, happens exclusively here.
 */
const betterstackToken = import.meta.env.NX_PUBLIC_BETTERSTACK_RUM_TOKEN;

let hasLoadedScript = false;

export function useAnalyticsTagLoader(consented: boolean) {
  const { appInfo, version } = useAtomValue(fromAppState.appInfoState);

  useEffect(() => {
    if (hasLoadedScript || !consented || !betterstackToken || !appInfo || window.betterstack) {
      return;
    }
    hasLoadedScript = true;

    const betterstack: BetterStackTag = (...args: BetterStackCommand) => {
      (betterstack.q = betterstack.q || []).push(args);
    };
    betterstack.l = Date.now();
    window.betterstack = betterstack;

    window.betterstack('init', {
      environment: appInfo.environment,
      release: version || 'unknown',
      autoPageview: true,
    });

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://betterstack.net/b.js?t=${betterstackToken}`;
    document.head.appendChild(script);
  }, [consented, appInfo, version]);
}
