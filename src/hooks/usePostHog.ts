import { usePostHog as usePostHogReact } from 'posthog-js/react';

export function usePostHog() {
    return usePostHogReact();
}
