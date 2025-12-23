import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock db query so we can assert the SQL used without needing a real DB.
vi.mock('../db', () => {
  return {
    query: vi.fn(async () => []),
  };
});

import { query } from '../db';
import * as oauthService from './oauth.service';

describe('oauth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUserTokens queries oauth_access_tokens (not legacy access_tokens)', async () => {
    await oauthService.getUserTokens('user-1');

    expect(query).toHaveBeenCalledTimes(1);
    const [sql] = (query as unknown as any).mock.calls[0];

    expect(String(sql)).toContain('oauth_access_tokens');
    expect(String(sql)).not.toContain(' access_tokens');
  });
});
