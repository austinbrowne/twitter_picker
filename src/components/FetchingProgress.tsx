/**
 * Progress indicator while fetching from Twitter API
 */

import { useApp } from '@/context/AppContext';

export function FetchingProgress() {
  const { state } = useApp();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        {/* Animated spinner */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Fetching from Twitter API
        </h2>

        <p className="text-gray-600 mb-4">
          {state.progressMessage || 'Connecting to Twitter...'}
        </p>

        {/* Progress details */}
        <div className="text-sm text-gray-500 space-y-1">
          <p>This may take a few minutes depending on engagement.</p>
          <p>Please don't close this window.</p>
        </div>

        {/* Tips */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
          <h3 className="font-medium text-gray-700 mb-2">While you wait:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Retweeters and likers are fetched in batches of 100</li>
            <li>• Follow verification is slower due to rate limits</li>
            <li>• Large giveaways may hit API limits</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
