import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Site Studio removes inherited sequence privileges before granting draft creation access', () => {
  const sql = fs.readFileSync(new URL('../../supabase/proposals/20261020_site_studio_v1.sql', import.meta.url), 'utf8');
  const revoke = sql.indexOf('revoke all on sequence public.os_site_content_revisions_revision_seq from public, anon, authenticated;');
  const grant = sql.indexOf('grant usage, select on sequence public.os_site_content_revisions_revision_seq to authenticated;');
  assert.ok(revoke >= 0 && grant > revoke, 'A grant alone does not remove inherited UPDATE');
  assert.doesNotMatch(sql, /grant\s+(?:all|update)\b[^;]*\bsequence\s+public\.os_site_content_revisions_revision_seq/i);
});
