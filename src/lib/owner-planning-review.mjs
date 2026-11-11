// Owner-confirmed identity for read-only review while Production reconciliation is pending.
// This is not an event relationship or authority to change either record.
const cases = new Map([
  ["2fd7f957-abae-491e-96fe-46ef88410016", Object.freeze({
    sourceEventId: "ef3c4ef1-0794-4c2f-b69b-620dde4c3a3e",
    assignmentId: "92b8fb5b-9c03-44ab-a650-36d35f0e8283",
  })],
]);

export function ownerPlanningReviewForGig(eventId) {
  return cases.get(eventId) ?? null;
}
