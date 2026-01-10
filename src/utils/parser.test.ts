import { describe, it, expect } from 'vitest';
import { parseManualInput, parseCSV, parseJSON, parseInput } from './parser';

describe('parseManualInput', () => {
  it('parses simple usernames', () => {
    const result = parseManualInput('user1\nuser2\nuser3');
    expect(result.participants.length).toBe(3);
    expect(result.participants[0].username).toBe('user1');
  });

  it('handles @ prefix', () => {
    const result = parseManualInput('@user1\n@user2');
    expect(result.participants[0].username).toBe('user1');
    expect(result.participants[1].username).toBe('user2');
  });

  it('handles comma-separated', () => {
    const result = parseManualInput('user1, user2, user3');
    expect(result.participants.length).toBe(3);
  });

  it('removes duplicates', () => {
    const result = parseManualInput('user1\nuser1\nUSER1');
    expect(result.participants.length).toBe(1);
    expect(result.warnings).toContain('Duplicate username: @user1');
    expect(result.warnings).toContain('Duplicate username: @USER1');
  });

  it('extracts username from Twitter URL', () => {
    const result = parseManualInput('https://twitter.com/testuser');
    expect(result.participants.length).toBe(1);
    expect(result.participants[0].username).toBe('testuser');
  });

  it('warns about invalid usernames', () => {
    const result = parseManualInput('valid_user\ninvalid user name\ntest');
    expect(result.participants.length).toBe(2);
    expect(result.warnings).toBeDefined();
  });

  it('handles empty input', () => {
    const result = parseManualInput('');
    expect(result.participants.length).toBe(0);
  });
});

describe('parseCSV', () => {
  it('parses CSV with header', () => {
    const csv = `username,displayName,followers
user1,User One,1000
user2,User Two,2000`;

    const result = parseCSV(csv);
    expect(result.participants.length).toBe(2);
    expect(result.participants[0].username).toBe('user1');
    expect(result.participants[0].displayName).toBe('User One');
    expect(result.participants[0].followerCount).toBe(1000);
  });

  it('handles different header names', () => {
    const csv = `handle,name,follower_count
user1,User One,1000`;

    const result = parseCSV(csv);
    expect(result.participants.length).toBe(1);
  });

  it('requires username column', () => {
    const csv = `name,followers
User One,1000`;

    const result = parseCSV(csv);
    expect(result.errors).toContain('CSV must have a "username" column');
  });

  it('handles quoted values', () => {
    const csv = `username,bio
user1,"Hello, world!"`;

    const result = parseCSV(csv);
    expect(result.participants[0].bio).toBe('Hello, world!');
  });

  it('removes @ from usernames', () => {
    const csv = `username
@user1
user2`;

    const result = parseCSV(csv);
    expect(result.participants[0].username).toBe('user1');
  });
});

describe('parseJSON', () => {
  it('parses array of user objects', () => {
    const json = JSON.stringify([
      { username: 'user1', followers_count: 1000 },
      { username: 'user2', followers_count: 2000 },
    ]);

    const result = parseJSON(json);
    expect(result.participants.length).toBe(2);
    expect(result.participants[0].followerCount).toBe(1000);
  });

  it('handles Twitter API v2 format', () => {
    const json = JSON.stringify({
      data: [
        { username: 'user1', name: 'User One' },
        { username: 'user2', name: 'User Two' },
      ],
    });

    const result = parseJSON(json);
    expect(result.participants.length).toBe(2);
  });

  it('handles screen_name field', () => {
    const json = JSON.stringify([{ screen_name: 'user1' }]);

    const result = parseJSON(json);
    expect(result.participants[0].username).toBe('user1');
  });

  it('handles invalid JSON', () => {
    const result = parseJSON('not valid json');
    expect(result.errors).toContain('Invalid JSON format');
  });

  it('removes duplicates', () => {
    const json = JSON.stringify([
      { username: 'user1' },
      { username: 'user1' },
    ]);

    const result = parseJSON(json);
    expect(result.participants.length).toBe(1);
  });
});

describe('parseInput (auto-detect)', () => {
  it('detects JSON array', () => {
    const result = parseInput('[{"username": "user1"}]');
    expect(result.source).toBe('json');
  });

  it('detects JSON object', () => {
    const result = parseInput('{"data": [{"username": "user1"}]}');
    expect(result.source).toBe('json');
  });

  it('detects CSV', () => {
    const result = parseInput('username,followers\nuser1,1000');
    expect(result.source).toBe('csv');
  });

  it('defaults to manual', () => {
    const result = parseInput('user1\nuser2');
    expect(result.source).toBe('manual');
  });
});
