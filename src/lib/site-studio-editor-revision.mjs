// Keep unsaved/publication concerns distinct without deleting older drafts.
export function siteStudioEditorRevision(revisions, published, showPublished = false) {
  if (showPublished && published) return published;
  const draft = revisions.find((revision) => revision.state === "draft");
  return draft && (!published || draft.revision > published.revision) ? draft : published;
}
