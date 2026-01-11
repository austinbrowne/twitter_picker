/**
 * Injected script - runs in the MAIN world (page context)
 * Intercepts fetch/XHR to capture Twitter API responses
 */

(function() {
  'use strict';

  // Use Symbol to avoid property name collisions and detection
  const urlSymbol = Symbol('twitterPickerUrl');

  const originalFetch = window.fetch;
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
