import test from 'node:test';
import assert from 'node:assert/strict';
import { siteStudioPublicLink } from '../lib/site-studio-public-link.mjs';

test('local Site Studio opens the matching isolated website without changing live navigation', () => {
  const local = { EVENTSIBLE_LOCAL_DEMO: 'true', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:56521' };
  assert.equal(siteStudioPublicLink(local).href, 'http://127.0.0.1:5173/');
  assert.equal(siteStudioPublicLink({}).href, 'https://eventsible.info');
  for (const override of [{ VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview' }, { NETLIFY: 'true' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://cplpbzudjprzbnzocirc.supabase.co' }]) {
    assert.equal(siteStudioPublicLink({ ...local, ...override }).href, 'https://eventsible.info');
  }
});
