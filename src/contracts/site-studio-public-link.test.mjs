import test from 'node:test';
import assert from 'node:assert/strict';
import { siteStudioPublicLink } from '../lib/site-studio-public-link.mjs';

test('local Site Studio opens the matching isolated website without changing live navigation', () => {
  const local = { EVENTSIBLE_LOCAL_DEMO: 'true', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:56521' };
  assert.equal(siteStudioPublicLink(local).href, 'http://127.0.0.1:5173/');
  assert.equal(siteStudioPublicLink({}).href, 'https://eventsible.info');
  for (const override of [{ VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview' }, { NETLIFY: 'true' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://production.example.invalid' }]) {
    assert.equal(siteStudioPublicLink({ ...local, ...override }).href, 'https://eventsible.info');
  }
});

test('hosted matching Preview navigation cannot change Production or enable local draft rendering', () => {
  const preview = { VERCEL_ENV: 'preview', EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL: 'https://eventsible-info-synthetic.vercel.app/' };
  assert.deepEqual(siteStudioPublicLink(preview), { href: preview.EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL, label: 'Open matching public Preview' });
  for (const VERCEL_ENV of ['production', 'development', undefined]) {
    assert.equal(siteStudioPublicLink({ ...preview, VERCEL_ENV }).href, 'https://eventsible.info');
  }
  for (const url of ['http://eventsible-info-synthetic.vercel.app/', 'https://eventsible.info/',
    'https://fake.vercel.app.example.invalid/', 'https://private@eventsible-info-synthetic.vercel.app/',
    'https://eventsible-info-synthetic.vercel.app:444/', 'https://eventsible-info-synthetic.vercel.app/private',
    'https://eventsible-info-synthetic.vercel.app/?token=secret', 'https://eventsible-info-synthetic.vercel.app/#draft', 'invalid']) {
    assert.equal(siteStudioPublicLink({ ...preview, EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL: url }).href, 'https://eventsible.info');
  }
  assert.notEqual(siteStudioPublicLink(preview).href, 'http://127.0.0.1:5173/');
});
