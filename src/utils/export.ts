/**
 * Export utilities for saving draw results
 */

import type { Draw, Participant, ExportFormat } from '@/types';

/**
 * Export draw results to CSV format
 */
export function exportToCSV(draw: Draw): string {
  const lines: string[] = [];

  // Header
  lines.push('Rank,Type,Username,Display Name,Followers,Following,Tweets,Account Created,Verified');

  // Winners
  draw.winners.forEach((winner, index) => {
    lines.push(formatCSVRow('Winner', index + 1, winner));
  });

  // Alternates
  if (draw.alternates) {
    draw.alternates.forEach((alt, index) => {
      lines.push(formatCSVRow('Alternate', index + 1, alt));
    });
  }

  return lines.join('\n');
}

function formatCSVRow(type: string, rank: number, participant: Participant): string {
  const fields = [
    rank.toString(),
    type,
    `@${participant.username}`,
    escapeCSV(participant.displayName || ''),
    participant.followerCount?.toString() || '',
    participant.followingCount?.toString() || '',
    participant.tweetCount?.toString() || '',
    participant.createdAt?.toISOString() || '',
    participant.isVerified ? 'Yes' : 'No',
  ];

  return fields.join(',');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export draw results to JSON format
 */
export function exportToJSON(draw: Draw): string {
  const exportData = {
    drawId: draw.id,
    timestamp: draw.timestamp.toISOString(),
    tweetUrl: draw.tweetUrl,
    verification: {
      participantHash: draw.participantHash,
      randomSeed: draw.randomSeed,
    },
    statistics: {
      totalParticipants: draw.allParticipants.length,
      eligibleParticipants: draw.eligibleParticipants.length,
      filteredOut: draw.filterStats.filtered,
      winnersSelected: draw.winners.length,
    },
    filterConfig: draw.filterConfig,
    winners: draw.winners.map(formatParticipantForExport),
    alternates: draw.alternates?.map(formatParticipantForExport) || [],
  };

  return JSON.stringify(exportData, null, 2);
}

function formatParticipantForExport(participant: Participant): Record<string, unknown> {
  return {
    username: participant.username,
    displayName: participant.displayName,
    profileUrl: `https://twitter.com/${participant.username}`,
    followerCount: participant.followerCount,
    followingCount: participant.followingCount,
    tweetCount: participant.tweetCount,
    isVerified: participant.isVerified,
    accountCreated: participant.createdAt?.toISOString(),
  };
}

/**
 * Export winners as plain text list
 */
export function exportToText(draw: Draw): string {
  const lines: string[] = [];

  lines.push(`Twitter Giveaway Results`);
  lines.push(`Draw ID: ${draw.id}`);
  lines.push(`Date: ${draw.timestamp.toLocaleString()}`);
  if (draw.tweetUrl) {
    lines.push(`Tweet: ${draw.tweetUrl}`);
  }
  lines.push('');
  lines.push(`Winners (${draw.winners.length}):`);
  lines.push('-'.repeat(40));

  draw.winners.forEach((winner, index) => {
    lines.push(`${index + 1}. @${winner.username}${winner.displayName ? ` (${winner.displayName})` : ''}`);
  });

  if (draw.alternates && draw.alternates.length > 0) {
    lines.push('');
    lines.push(`Alternates (${draw.alternates.length}):`);
    lines.push('-'.repeat(40));
    draw.alternates.forEach((alt, index) => {
      lines.push(`${index + 1}. @${alt.username}${alt.displayName ? ` (${alt.displayName})` : ''}`);
    });
  }

  lines.push('');
  lines.push(`Statistics:`);
  lines.push(`- Total participants: ${draw.allParticipants.length}`);
  lines.push(`- Eligible after filtering: ${draw.eligibleParticipants.length}`);
  lines.push(`- Filtered out: ${draw.filterStats.filtered}`);
  lines.push('');
  lines.push(`Verification Hash: ${draw.participantHash.substring(0, 16)}...`);

  return lines.join('\n');
}

/**
 * Export draw results in specified format
 */
export function exportDraw(draw: Draw, format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return exportToCSV(draw);
    case 'json':
      return exportToJSON(draw);
    case 'text':
      return exportToText(draw);
    default:
      return exportToText(draw);
  }
}

/**
 * Download a file with the given content
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Download draw results
 */
export function downloadDraw(draw: Draw, format: ExportFormat): void {
  const content = exportDraw(draw, format);
  const timestamp = draw.timestamp.toISOString().split('T')[0];

  const extensions: Record<ExportFormat, string> = {
    csv: 'csv',
    json: 'json',
    text: 'txt',
  };

  const mimeTypes: Record<ExportFormat, string> = {
    csv: 'text/csv',
    json: 'application/json',
    text: 'text/plain',
  };

  const filename = `giveaway-${draw.id}-${timestamp}.${extensions[format]}`;
  downloadFile(content, filename, mimeTypes[format]);
}

/**
 * Copy winner list to clipboard
 */
export async function copyWinnersToClipboard(draw: Draw): Promise<void> {
  const winners = draw.winners.map(w => `@${w.username}`).join('\n');
  await navigator.clipboard.writeText(winners);
}

/**
 * Generate a shareable results URL (base64 encoded minimal data)
 */
export function generateShareableUrl(draw: Draw): string {
  const minimalData = {
    id: draw.id,
    ts: draw.timestamp.getTime(),
    w: draw.winners.map(w => w.username),
    h: draw.participantHash.substring(0, 16),
  };

  const encoded = btoa(JSON.stringify(minimalData));
  const baseUrl = window.location.origin + window.location.pathname;

  return `${baseUrl}#results=${encoded}`;
}

/**
 * Parse a shareable results URL
 */
export function parseShareableUrl(url: string): {
  id: string;
  timestamp: Date;
  winners: string[];
  hashPrefix: string;
} | null {
  try {
    const hashPart = url.split('#results=')[1];
    if (!hashPart) return null;

    const decoded = JSON.parse(atob(hashPart));
    return {
      id: decoded.id,
      timestamp: new Date(decoded.ts),
      winners: decoded.w,
      hashPrefix: decoded.h,
    };
  } catch {
    return null;
  }
}
