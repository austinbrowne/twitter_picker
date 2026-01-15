/**
 * Injected script - runs in the MAIN world (page context)
 * Intercepts fetch/XHR to capture Twitter API responses
 * Also handles authenticated API requests from content script
 */

(function() {
  'use strict';

  // Use Symbol to avoid property name collisions and detection
  const urlSymbol = Symbol('twitterPickerUrl');

  const originalFetch = window.fetch;

  // Listen for requests from content script to make authenticated API calls
  window.addEventListener('message', async (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'TWITTER_PICKER_FETCH_REQUEST') return;

    const { requestId, url, options } = event.data;
    console.log('[Twitter Picker Injected] Received fetch request:', url?.substring(0, 100));

    try {
      // Get CSRF token from cookie
      const csrfToken = document.cookie.split('; ')
        .find(row => row.startsWith('ct0='))
        ?.split('=')[1];

      // Twitter's public bearer token (same for all users)
      const bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

      console.log('[Twitter Picker Injected] Making fetch with auth headers...');
      const response = await originalFetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options?.headers,
          'authorization': `Bearer ${bearerToken}`,
          'x-csrf-token': csrfToken || '',
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes'
        }
      });

      console.log('[Twitter Picker Injected] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error body');
        console.error('[Twitter Picker Injected] Request failed:', response.status, errorText.substring(0, 200));
        window.postMessage({
          type: 'TWITTER_PICKER_FETCH_RESPONSE',
          requestId,
          error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
        }, window.location.origin);
        return;
      }

      const data = await response.json();
      window.postMessage({
        type: 'TWITTER_PICKER_FETCH_RESPONSE',
        requestId,
        data
      }, window.location.origin);
    } catch (e) {
      window.postMessage({
        type: 'TWITTER_PICKER_FETCH_RESPONSE',
        requestId,
        error: e.message
      }, window.location.origin);
    }
  });
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = args[0]?.url || args[0]?.toString() || args[0];

      if (typeof url === 'string' && (url.includes('/graphql/') || url.includes('/2/'))) {
        try {
          const clone = response.clone();
          const data = await clone.json();

          window.postMessage({
            type: 'TWITTER_PICKER_API_RESPONSE',
            url: url,
            data: data
          }, window.location.origin);
        } catch (e) {
          // Not JSON or parse error
        }
      }
    } catch (e) {
      // Intercept error - fail silently
    }

    return response;
  };

  // Also intercept XHR just in case
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this[urlSymbol] = url;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    this.addEventListener('load', function() {
      try {
        const url = xhr[urlSymbol];
        if (url && (url.includes('/graphql/') || url.includes('/2/'))) {
          const data = JSON.parse(xhr.responseText);
          window.postMessage({
            type: 'TWITTER_PICKER_API_RESPONSE',
            url: url,
            data: data
          }, window.location.origin);
        }
      } catch (e) {
        // Parse error
      }
    });
    return originalXHRSend.apply(this, arguments);
  };
})();
