/**
 * Component for configuring bot/fake account filters
 */

import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { filterParticipants, suggestFilters, generateFilterSummary } from '@/utils';
import type { FilterConfig as FilterConfigType } from '@/types';

export function FilterConfig() {
  const { state, setFilterConfig, setWinnerCount, setAlternateCount, setStep } = useApp();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [blacklistInput, setBlacklistInput] = useState(state.filterConfig.blacklist.join('\n'));

  // Calculate filter preview
  const filterPreview = useMemo(() => {
    return filterParticipants(state.participants, state.filterConfig);
  }, [state.participants, state.filterConfig]);

  // Get suggested filters based on data
  const suggestedFilters = useMemo(() => {
    return suggestFilters(state.participants);
  }, [state.participants]);

  const handleFilterChange = (key: keyof FilterConfigType, value: number | boolean) => {
    setFilterConfig({ [key]: value });
  };

  const handleBlacklistChange = (text: string) => {
    setBlacklistInput(text);
    const usernames = text
      .split(/[\n,]+/)
      .map(u => u.trim().replace(/^@/, ''))
      .filter(u => u.length > 0);
    setFilterConfig({ blacklist: usernames });
  };

  const handleApplySuggested = () => {
    setFilterConfig(suggestedFilters);
  };

  const hasEnoughData = state.participants.some(
    p => p.followerCount !== undefined || p.createdAt !== undefined
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Configure Filters</h2>
            <p className="text-gray-600">Filter out bot and fake accounts</p>
          </div>
          <button
            onClick={() => setStep('input')}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </div>

        {/* Filter preview */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">After applying filters:</p>
              <p className="text-2xl font-bold text-gray-800">
                {filterPreview.passed.length.toLocaleString()}{' '}
                <span className="text-base font-normal text-gray-500">
                  of {state.participants.length.toLocaleString()} eligible
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Filtered out:</p>
              <p className="text-xl font-semibold text-red-500">
                {filterPreview.filtered.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Data availability notice */}
        {!hasEnoughData && (
          <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-amber-700 text-sm">
              <strong>Note:</strong> Your participant data doesn't include follower counts or
              account ages. Filters requiring this data won't have any effect. Consider using a
              HAR file or JSON export with full user data.
            </p>
          </div>
        )}

        {/* Suggested filters */}
        {Object.keys(suggestedFilters).length > 0 && (
          <div className="mb-6">
            <button
              onClick={handleApplySuggested}
              className="text-x-blue hover:text-blue-700 text-sm font-medium"
            >
              Apply suggested filters based on your data
            </button>
          </div>
        )}

        {/* Winner count */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Winners
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={state.winnerCount}
              onChange={(e) => setWinnerCount(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alternates (backup winners)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={state.alternateCount}
              onChange={(e) => setAlternateCount(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent"
            />
          </div>
        </div>

        {/* Basic filters */}
        <div className="space-y-4 mb-6">
          <h3 className="font-semibold text-gray-800">Basic Filters</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Followers
              </label>
              <input
                type="number"
                min={0}
                value={state.filterConfig.minFollowers}
                onChange={(e) =>
                  handleFilterChange('minFollowers', parseInt(e.target.value) || 0)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Tweets
              </label>
              <input
                type="number"
                min={0}
                value={state.filterConfig.minTweets}
                onChange={(e) =>
                  handleFilterChange('minTweets', parseInt(e.target.value) || 0)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Account Age (days)
              </label>
              <input
                type="number"
                min={0}
                value={state.filterConfig.minAccountAgeDays}
                onChange={(e) =>
                  handleFilterChange('minAccountAgeDays', parseInt(e.target.value) || 0)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.filterConfig.requireAvatar}
                  onChange={(e) => handleFilterChange('requireAvatar', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-x-blue focus:ring-x-blue"
                />
                <span className="ml-2 text-gray-700">Require profile picture</span>
              </label>
            </div>
          </div>
        </div>

        {/* Advanced filters toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
        >
          <svg
            className={`w-4 h-4 mr-2 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Advanced Filters
        </button>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="space-y-4 mb-6 pl-4 border-l-2 border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Following
                </label>
                <input
                  type="number"
                  min={0}
                  value={state.filterConfig.minFollowing}
                  onChange={(e) =>
                    handleFilterChange('minFollowing', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.filterConfig.requireBio}
                    onChange={(e) => handleFilterChange('requireBio', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-x-blue focus:ring-x-blue"
                  />
                  <span className="ml-2 text-gray-700">Require bio</span>
                </label>
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.filterConfig.onlyVerified}
                    onChange={(e) => handleFilterChange('onlyVerified', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-x-blue focus:ring-x-blue"
                  />
                  <span className="ml-2 text-gray-700">Only verified accounts</span>
                </label>
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.filterConfig.excludeDefaultProfile}
                    onChange={(e) =>
                      handleFilterChange('excludeDefaultProfile', e.target.checked)
                    }
                    className="w-5 h-5 rounded border-gray-300 text-x-blue focus:ring-x-blue"
                  />
                  <span className="ml-2 text-gray-700">Exclude default profiles</span>
                </label>
              </div>
            </div>

            {/* Blacklist */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Blacklist (one username per line)
              </label>
              <textarea
                value={blacklistInput}
                onChange={(e) => handleBlacklistChange(e.target.value)}
                placeholder="@bot_account1&#10;@spam_user2"
                className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent font-mono text-sm"
              />
            </div>
          </div>
        )}

        {/* Filter summary */}
        {filterPreview.filtered.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Filter Summary</h4>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap">
              {generateFilterSummary(filterPreview)}
            </pre>
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={() => setStep('draw')}
          disabled={filterPreview.passed.length === 0}
          className="w-full px-6 py-3 bg-x-blue text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Draw ({filterPreview.passed.length} eligible participants)
        </button>
      </div>
    </div>
  );
}
