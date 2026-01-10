/**
 * Component for displaying draw results
 */

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { downloadDraw, copyWinnersToClipboard, generateShareableUrl } from '@/utils';
import type { ExportFormat, Participant } from '@/types';

export function Results() {
  const { state, reset } = useApp();
  const { draw } = state;
  const [copied, setCopied] = useState(false);
  const [showAllEligible, setShowAllEligible] = useState(false);

  if (!draw) {
    return null;
  }

  const handleCopyWinners = async () => {
    await copyWinnersToClipboard(draw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format: ExportFormat) => {
    downloadDraw(draw, format);
  };

  const handleCopyShareLink = async () => {
    const url = generateShareableUrl(draw);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Success banner */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl shadow-lg p-6 mb-6 text-white text-center animate-bounce-in">
        <div className="flex items-center justify-center mb-2">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-1">Winners Selected!</h2>
        <p className="text-green-100">Draw ID: {draw.id}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Winners list */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Winners ({draw.winners.length})
              </h3>
              <button
                onClick={handleCopyWinners}
                className="text-x-blue hover:text-blue-700 text-sm font-medium"
              >
                {copied ? 'Copied!' : 'Copy all'}
              </button>
            </div>

            <div className="space-y-3">
              {draw.winners.map((winner, index) => (
                <WinnerCard key={winner.username} winner={winner} rank={index + 1} />
              ))}
            </div>

            {/* Alternates */}
            {draw.alternates && draw.alternates.length > 0 && (
              <>
                <h4 className="text-lg font-semibold text-gray-700 mt-6 mb-3">
                  Alternates ({draw.alternates.length})
                </h4>
                <div className="space-y-3">
                  {draw.alternates.map((alt, index) => (
                    <WinnerCard
                      key={alt.username}
                      winner={alt}
                      rank={index + 1}
                      isAlternate
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* All eligible participants */}
          <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
            <button
              onClick={() => setShowAllEligible(!showAllEligible)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-lg font-semibold text-gray-800">
                All Eligible Participants ({draw.eligibleParticipants.length})
              </h3>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  showAllEligible ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showAllEligible && (
              <div className="mt-4 max-h-64 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {draw.eligibleParticipants.map((p) => (
                    <a
                      key={p.username}
                      href={`https://twitter.com/${p.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`px-2 py-1 text-sm rounded-full ${
                        draw.winners.some((w) => w.username === p.username)
                          ? 'bg-green-100 text-green-700 font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      @{p.username}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Draw info */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Draw Details</h3>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Draw ID</dt>
                <dd className="font-mono text-gray-800">{draw.id}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Timestamp</dt>
                <dd className="text-gray-800">{draw.timestamp.toLocaleString()}</dd>
              </div>
              {draw.tweetUrl && (
                <div>
                  <dt className="text-gray-500">Tweet</dt>
                  <dd>
                    <a
                      href={draw.tweetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-x-blue hover:underline truncate block"
                    >
                      View tweet
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Total Participants</dt>
                <dd className="text-gray-800">{draw.allParticipants.length.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Eligible After Filtering</dt>
                <dd className="text-gray-800">
                  {draw.eligibleParticipants.length.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Filtered Out</dt>
                <dd className="text-gray-800">{draw.filterStats.filtered.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* Verification */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Verification</h3>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Participant Hash</dt>
                <dd className="font-mono text-xs text-gray-600 break-all">
                  {draw.participantHash.substring(0, 32)}...
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Random Seed</dt>
                <dd className="font-mono text-xs text-gray-600 break-all">
                  {draw.randomSeed.substring(0, 32)}...
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-gray-500">
              These values can be used to verify the draw was fair and the participant list wasn't
              modified.
            </p>
          </div>

          {/* Export */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Export Results</h3>

            <div className="space-y-2">
              <button
                onClick={() => handleExport('csv')}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Download CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Download JSON
              </button>
              <button
                onClick={() => handleExport('text')}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Download Text
              </button>
              <button
                onClick={handleCopyShareLink}
                className="w-full px-4 py-2 bg-x-blue text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                {copied ? 'Link Copied!' : 'Copy Share Link'}
              </button>
            </div>
          </div>

          {/* New draw */}
          <button
            onClick={reset}
            className="w-full px-6 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Start New Draw
          </button>
        </div>
      </div>
    </div>
  );
}

interface WinnerCardProps {
  winner: Participant;
  rank: number;
  isAlternate?: boolean;
}

function WinnerCard({ winner, rank, isAlternate }: WinnerCardProps) {
  return (
    <div
      className={`
        flex items-center p-4 rounded-lg border-2 transition-all animate-slide-up
        ${isAlternate ? 'border-purple-200 bg-purple-50' : 'border-green-200 bg-green-50'}
      `}
      style={{ animationDelay: `${rank * 100}ms` }}
    >
      <div
        className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white
          ${isAlternate ? 'bg-purple-500' : 'bg-green-500'}
        `}
      >
        {rank}
      </div>

      <div className="ml-4 flex-grow">
        <div className="flex items-center">
          <a
            href={`https://twitter.com/${winner.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-800 hover:text-x-blue"
          >
            @{winner.username}
          </a>
          {winner.isVerified && (
            <svg className="w-4 h-4 ml-1 text-x-blue" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
            </svg>
          )}
        </div>
        {winner.displayName && (
          <p className="text-sm text-gray-500">{winner.displayName}</p>
        )}
      </div>

      {winner.followerCount !== undefined && (
        <div className="text-right text-sm text-gray-500">
          <p>{winner.followerCount.toLocaleString()} followers</p>
        </div>
      )}

      <a
        href={`https://twitter.com/${winner.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-4 p-2 text-gray-400 hover:text-x-blue transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    </div>
  );
}
