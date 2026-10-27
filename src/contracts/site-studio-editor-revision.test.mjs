import test from 'node:test';
import assert from 'node:assert/strict';
import { siteStudioEditorRevision } from '../lib/site-studio-editor-revision.mjs';

test('publishing does not reopen an older draft and restoration can show the exact publication', () => {
  const draft = { id: 'draft', revision: 13, state: 'draft' };
  const recent = { id: 'recent', revision: 15, state: 'published' };
  const restored = { id: 'restored', revision: 1, state: 'published' };
  const rows = [recent, draft];
  assert.equal(siteStudioEditorRevision(rows, recent), recent);
  assert.equal(siteStudioEditorRevision(rows, restored), draft);
  assert.equal(siteStudioEditorRevision(rows, restored, true), restored);
  assert.equal(siteStudioEditorRevision([], restored), restored);
  assert.equal(siteStudioEditorRevision([draft], null), draft);
  assert.equal(siteStudioEditorRevision([], null), null);
  assert.equal(draft.state, 'draft', 'Selecting a publication must preserve existing private drafts');
});
