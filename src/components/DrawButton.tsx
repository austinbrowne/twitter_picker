/**
 * Component for performing the random draw
 */

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { filterParticipants } from '@/utils';

export function DrawButton() {
  const { state, performDraw, setStep } = useApp();
  const [isAnimating, setIsAnimating] = useState(false);

  const filterResult = useMemo(() => {
    return filterParticipants(state.participants, state.filterConfig);
  }, [state.participants, state.filterConfig]);

  const handleDraw = async () => {
    setIsAnimating(true);

    // Add a small delay for dramatic effect
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await performDraw();
    setIsAnimating(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Draw Winners</h2>
            <p className="text-gray-600">Ready to select random winners</p>
          </div>
          <button
            onClick={() => setStep('filter')}
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

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">
              {state.participants.length.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Total Participants</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {filterResult.passed.length.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Eligible</p>
          </div>
          <div className="bg-x-blue/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-x-blue">{state.winnerCount}</p>
            <p className="text-sm text-gray-500">Winners</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{state.alternateCount}</p>
            <p className="text-sm text-gray-500">Alternates</p>
          </div>
        </div>

        {/* Tweet URL if provided */}
        {state.tweetUrl && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Tweet:</strong>{' '}
              <a
                href={state.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-x-blue hover:underline"
              >
                {state.tweetUrl}
              </a>
            </p>
          </div>
        )}

        {/* Draw button */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleDraw}
            disabled={state.isLoading || isAnimating || filterResult.passed.length === 0}
            className={`
              relative w-48 h-48 rounded-full font-bold text-xl text-white
              transition-all transform hover:scale-105
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              ${isAnimating ? 'animate-pulse-soft' : ''}
              ${
                filterResult.passed.length === 0
                  ? 'bg-gray-400'
                  : 'bg-gradient-to-br from-x-blue to-blue-600 hover:from-blue-500 hover:to-blue-700 shadow-xl hover:shadow-2xl'
              }
            `}
          >
            {isAnimating ? (
              <div className="flex flex-col items-center">
                <svg
                  className="w-12 h-12 animate-spin mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Drawing...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg
                  className="w-12 h-12 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>DRAW</span>
              </div>
            )}

            {/* Animated ring */}
            {isAnimating && (
              <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
            )}
          </button>

          <p className="mt-6 text-gray-500 text-center max-w-md">
            Click the button to randomly select{' '}
            <strong>
              {state.winnerCount} winner{state.winnerCount > 1 ? 's' : ''}
            </strong>
            {state.alternateCount > 0 && (
              <>
                {' '}
                and <strong>{state.alternateCount} alternate{state.alternateCount > 1 ? 's' : ''}</strong>
              </>
            )}{' '}
            from {filterResult.passed.length.toLocaleString()} eligible participants.
          </p>
        </div>

        {/* Error message */}
        {state.error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{state.error}</p>
          </div>
        )}

        {/* Fairness note */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Fair & Transparent Selection
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>Uses cryptographically secure random number generation (Web Crypto API)</li>
            <li>Each draw generates a unique verification ID</li>
            <li>Participant list is hashed for tamper verification</li>
            <li>All processing happens in your browser - no data sent to servers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
