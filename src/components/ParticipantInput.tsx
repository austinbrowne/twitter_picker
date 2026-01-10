/**
 * Component for inputting participant data
 */

import React, { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { parseInput } from '@/utils';

export function ParticipantInput() {
  const { state, setParticipants, setStep, setTweetUrl } = useApp();
  const [inputText, setInputText] = useState('');
  const [inputMethod, setInputMethod] = useState<'paste' | 'file'>('paste');
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    count: number;
    warnings?: string[];
    errors?: string[];
  } | null>(null);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setParseResult(null);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      setParseResult(null);
    };
    reader.readAsText(file);
  }, []);

  const handleParse = useCallback(() => {
    if (!inputText.trim()) {
      setParseResult({
        success: false,
        count: 0,
        errors: ['Please enter some participant data'],
      });
      return;
    }

    const result = parseInput(inputText);
    setParticipants(result.participants);

    setParseResult({
      success: result.participants.length > 0,
      count: result.participants.length,
      warnings: result.warnings,
      errors: result.errors,
    });
  }, [inputText, setParticipants]);

  const handleContinue = useCallback(() => {
    if (state.participants.length > 0) {
      setStep('filter');
    }
  }, [state.participants.length, setStep]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Add Participants</h2>
        <p className="text-gray-600 mb-6">
          Enter usernames, paste JSON/CSV data, or upload a file with participant information.
        </p>

        {/* Tweet URL (optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tweet URL (optional)
          </label>
          <input
            type="url"
            value={state.tweetUrl}
            onChange={(e) => setTweetUrl(e.target.value)}
            placeholder="https://twitter.com/username/status/123456789"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent"
          />
        </div>

        {/* Input method toggle */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setInputMethod('paste')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              inputMethod === 'paste'
                ? 'bg-x-blue text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Paste Data
          </button>
          <button
            onClick={() => setInputMethod('file')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              inputMethod === 'file'
                ? 'bg-x-blue text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Upload File
          </button>
        </div>

        {/* Input area */}
        {inputMethod === 'paste' ? (
          <div className="mb-4">
            <textarea
              value={inputText}
              onChange={handleTextChange}
              placeholder={`Enter usernames (one per line), or paste JSON/CSV data:

@username1
@username2
username3

Or paste JSON from Twitter API, HAR file content, etc.`}
              className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-x-blue focus:border-transparent font-mono text-sm resize-none"
            />
          </div>
        ) : (
          <div className="mb-4">
            <label className="block w-full p-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-x-blue hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept=".json,.csv,.txt,.har"
                onChange={handleFileUpload}
                className="hidden"
              />
              <svg
                className="w-12 h-12 mx-auto text-gray-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-gray-600 font-medium">
                Click to upload or drag and drop
              </span>
              <br />
              <span className="text-sm text-gray-400">
                JSON, CSV, TXT, or HAR files
              </span>
            </label>
            {inputText && (
              <p className="mt-2 text-sm text-green-600">
                File loaded ({inputText.length.toLocaleString()} characters)
              </p>
            )}
          </div>
        )}

        {/* Parse result */}
        {parseResult && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              parseResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {parseResult.success ? (
              <p className="text-green-700 font-medium">
                Successfully parsed {parseResult.count.toLocaleString()} participants
              </p>
            ) : (
              <p className="text-red-700 font-medium">Failed to parse participants</p>
            )}

            {parseResult.warnings && parseResult.warnings.length > 0 && (
              <div className="mt-2">
                <p className="text-amber-600 text-sm font-medium">Warnings:</p>
                <ul className="text-amber-600 text-sm list-disc list-inside">
                  {parseResult.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {parseResult.warnings.length > 5 && (
                    <li>...and {parseResult.warnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {parseResult.errors && parseResult.errors.length > 0 && (
              <div className="mt-2">
                <ul className="text-red-600 text-sm list-disc list-inside">
                  {parseResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleParse}
            disabled={!inputText.trim()}
            className="flex-1 px-6 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Parse Participants
          </button>
          <button
            onClick={handleContinue}
            disabled={state.participants.length === 0}
            className="flex-1 px-6 py-3 bg-x-blue text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue with {state.participants.length} participants
          </button>
        </div>

        {/* Help section */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Supported Input Formats</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>
              <strong>Usernames:</strong> One per line, with or without @ symbol
            </li>
            <li>
              <strong>CSV:</strong> Must have a "username" column header
            </li>
            <li>
              <strong>JSON:</strong> Array of objects with username field
            </li>
            <li>
              <strong>HAR:</strong> Browser network recording from Twitter/X
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
