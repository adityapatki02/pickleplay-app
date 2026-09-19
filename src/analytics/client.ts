// Native (iOS/Android) PostHog client. The web build resolves ./client.web.ts
// instead (Metro platform extensions), so posthog-react-native never ships in
// the kiosk bundle and posthog-js never ships in the store apps.
import PostHog from 'posthog-react-native';

let ph: PostHog | null = null;

export function init(apiKey: string, host: string): void {
  ph = new PostHog(apiKey, {
    host,
    // "Application Opened / Backgrounded / Installed / Updated" out of the box.
    captureAppLifecycleEvents: true,
    flushAt: 10,
    flushInterval: 10000,
  });
}
export function identify(id: string, props?: Record<string, any>): void { ph?.identify(id, props); }
export function reset(): void { ph?.reset(); }
export function capture(event: string, props?: Record<string, any>): void { ph?.capture(event, props); }
export function screen(name: string, props?: Record<string, any>): void { ph?.screen(name, props); }
