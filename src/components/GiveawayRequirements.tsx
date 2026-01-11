/**
 * Giveaway Requirements Configuration
 *
 * Set up the tweet URL and entry requirements
 */

import { useState } from 'react';
import { useApp } from '@/context/AppContext';

export function GiveawayRequirements() {
  const { state, setGiveawayConfig, setStep, fetchParticipants } = useApp();
  const [followInputs, setFollowInputs] = useState<string[]>(
    state.giveawayConfig.mustFollow.length > 0
      ? state.giveawayConfig.mustFollow
      : ['', '']
  );

  const handleAddFollowAccount = () => {
    setFollowInputs([...followInputs, '']);
  };

  const handleRemoveFollowAccount = (index: number) => {
    const newInputs = followInputs.filter((_, i) => i !== index);
    setFollowInputs(newInputs);
    setGiveawayConfig({ mustFollow: newInputs.filter(u => u.trim()) });
  };

  const handleFollowInputChange = (index: number, value: string) => {
    const newInputs = [...followInputs];
    newInputs[index] = value;
    setFollowInputs(newInputs);
    setGiveawayConfig({ mustFollow: newInputs.filter(u => u.trim()) });
  };

  const handleFetch = async () => {
    await fetchParticipants();
  };

  const isValid =
    state.giveawayConfig.tweetUrl &&
    (state.giveawayConfig.requireRetweet || state.giveawayConfig.requireLike);

  const hasApiToken = state.inputMode === 'api' && state.giveawayConfig.bearerToken;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Giveaway Requirements</h2>
            <p className="text-gray-600">Configure entry requirements</p>
          </div>
          {state.inputMode === 'api' && (
            <button
              onClick={() => setStep('setup')}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-700">{state.error}</p>
          </div>
        )}

        {/* Tweet URL */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tweet URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={state.giveawayConfig.tweetUrl}
            onChange={(e) => setGiveawayConfig({ tweetUrl: e.target.value })}
            placeholder="https://twitter.com/username/status/123456789"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-sm text-gray-500">
            Paste the full URL of your giveaway tweet
          </p>
        </div>

        {/* Entry Requirements */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Entry Requirements
          </label>

          <div className="space-y-3">
            <label className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={state.giveawayConfig.requireRetweet}
                onChange={(e) => setGiveawayConfig({ requireRetweet: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <div className="ml-3">
                <span className="font-medium text-gray-800">Must Retweet</span>
                <p className="text-sm text-gray-500">Participants must retweet the giveaway tweet</p>
              </div>
            </label>

            <label className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={state.giveawayConfig.requireLike}
                onChange={(e) => setGiveawayConfig({ requireLike: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <div className="ml-3">
                <span className="font-medium text-gray-800">Must Like</span>
                <p className="text-sm text-gray-500">Participants must like the giveaway tweet</p>
              </div>
            </label>
          </div>
        </div>

        {/* Must Follow Accounts */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Must Follow Accounts
            </label>
            <button
              onClick={handleAddFollowAccount}
              className="text-sm text-blue-500 hover:text-blue-700 font-medium"
            >
              + Add Account
            </button>
          </div>

          <div className="space-y-3">
            {followInputs.map((input, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="relative flex-grow">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => handleFollowInputChange(index, e.target.value)}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {followInputs.length > 1 && (
                  <button
                    onClick={() => handleRemoveFollowAccount(index)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {hasApiToken && state.giveawayConfig.mustFollow.filter(u => u.trim()).length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> Follow verification is slow due to Twitter API rate limits
                (15 requests per 15 minutes). For {state.giveawayConfig.mustFollow.filter(u => u.trim()).length} accounts,
                this could take several minutes depending on participant count.
              </p>
            </div>
          )}
        </div>

        {/* Summary */}
        {isValid && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-2">Requirements Summary</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              {state.giveawayConfig.requireRetweet && <li>• Must retweet the tweet</li>}
              {state.giveawayConfig.requireLike && <li>• Must like the tweet</li>}
              {state.giveawayConfig.mustFollow.filter(u => u.trim()).map((account) => (
                <li key={account}>• Must follow @{account}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        {hasApiToken ? (
          <button
            onClick={handleFetch}
            disabled={!isValid || state.isLoading}
            className="w-full px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {state.isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Fetching...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Fetch Participants from Twitter
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => setStep('filter')}
            disabled={!isValid}
            className="w-full px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue to Manual Input
          </button>
        )}

        {/* Progress */}
        {state.isLoading && state.progressMessage && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 text-center">{state.progressMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
