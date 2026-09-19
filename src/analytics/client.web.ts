// Web (kiosk sites / console) PostHog client — posthog-js. Autocapture is
// OFF on purpose: we send named events and screen views only.
import posthog from 'posthog-js';

let ready = false;

export function init(apiKey: string, host: string): void {
  posthog.init(apiKey, {
    api_host: host,
    autocapture: false,
    capture_pageview: false, // screens are captured from the navigator
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    disable_session_recording: true,
  });
  ready = true;
}
export function identify(id: string, props?: Record<string, any>): void { if (ready) posthog.identify(id, props); }
export function reset(): void { if (ready) posthog.reset(); }
export function capture(event: string, props?: Record<string, any>): void { if (ready) posthog.capture(event, props); }
export function screen(name: string, props?: Record<string, any>): void {
  if (ready) posthog.capture('$screen', { $screen_name: name, ...props });
}
