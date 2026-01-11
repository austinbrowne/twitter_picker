/**
 * API Setup Component
 *
 * Configure Twitter API credentials
 */

import { useState } from 'react';
import { useApp } from '@/context/AppContext';

export function ApiSetup() {
  const { state, setGiveawayConfig, setStep, setInputMode } = useApp();
  const [showToken, setShowToken] = useState(false);

  const handleContinue = () => {
    if (state.giveawayConfig.bearerToken) {
      setStep('requirements');
    }
  };

  const handleManualMode = () => {
    setInputMode('manual');
    setStep('requirements');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Twitter API Setup</h2>
          <p className="text-gray-600 mt-2">
            Connect your Twitter API to verify giveaway requirements
          </p>
        </div>

        {/* API Cost Warning */}
        <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-amber-800">Twitter API Pricing</h3>
              <p className="text-sm text-amber-700 mt-1">
                Twitter API <strong>Basic tier ($100/month)</strong> is required for read access.
                The Free tier only allows posting, not reading retweets/likes.
              </p>
              <a
                href="https://developer.twitter.com/en/portal/products/basic"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-800 underline mt-2 inline-block"
              >
                Get API access →
              </a>
            </div>
          </div>
        </div>

        {/* Bearer Token Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bearer Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={state.giveawayConfig.bearerToken}
              onChange={(e) => setGiveawayConfig({ bearerToken: e.target.value })}
              placeholder="Enter your Twitter API Bearer Token"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Your token is stored locally and never sent to any server except Twitter's API.
          </p>
        </div>

        {/* How to get a token */}
        <details className="mb-6">
          <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
            How to get a Bearer Token?
          </summary>
          <div className="mt-3 p-4 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-2">
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Twitter Developer Portal</a></li>
              <li>Sign up for a developer account if you don't have one</li>
              <li>Subscribe to the <strong>Basic tier ($100/month)</strong></li>
              <li>Create a new Project and App</li>
              <li>Go to your App's "Keys and Tokens" section</li>
              <li>Generate a Bearer Token under "Authentication Tokens"</li>
              <li>Copy and paste it here</li>
            </ol>
          </div>
        </details>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!state.giveawayConfig.bearerToken}
          className="w-full px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Giveaway Setup
        </button>

        {/* Manual Mode Option */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500 mb-3">
            Don't have API access?
          </p>
          <button
            onClick={handleManualMode}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Use Manual Input Instead
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">
            Manual mode requires you to paste participant usernames
          </p>
        </div>
      </div>
    </div>
  );
}
