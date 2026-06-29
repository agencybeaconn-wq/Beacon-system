import posthog from 'posthog-js';
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

if (typeof window !== 'undefined' && key && host) {
    posthog.init(key, {
        api_host: host,
        // Disable in development
        loaded: (posthog) => {
            if (import.meta.env.MODE === 'development') {
                posthog.opt_out_capturing();
            }
        },
        // We will capture pageviews manually to ensure spa transitions are recorded
        capture_pageview: false,
        capture_pageleave: true,
        // Exception autocapture is usually enabled by default if configured
        autocapture: true,
    });
}

function PostHogPageviewTracker() {
    const location = useLocation();

    useEffect(() => {
        if (key && host && import.meta.env.MODE !== 'development') {
            posthog.capture('$pageview', {
                $current_url: window.location.href,
            });
        }
    }, [location]);

    return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    if (!key || !host) {
        return <>{children}</>;
    }

    return (
        <PostHogReactProvider client={posthog}>
            <PostHogPageviewTracker />
            {children}
        </PostHogReactProvider>
    );
}
