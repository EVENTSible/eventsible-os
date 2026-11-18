import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { googleEntryDateKeys } from './dates.mjs';
import { openRefreshToken, sealRefreshToken, shapeGoogleEvent } from './protocol.mjs';

const key = randomBytes(32).toString('base64');
const base = { id:'meeting_20261118T090000', summary:'Private appointment', status:'confirmed',
  start:{dateTime:'2026-11-18T09:00:00-05:00'}, end:{dateTime:'2026-11-18T10:00:00-05:00'} };

test('refresh tokens stay encrypted and authenticated', () => {
  const ciphertext = sealRefreshToken('owner-refresh-secret',key);
  assert.ok(!ciphertext.includes('owner-refresh-secret'));
  assert.equal(openRefreshToken(ciphertext,key),'owner-refresh-secret');
  assert.throws(() => openRefreshToken(ciphertext,randomBytes(32).toString('base64')));
});

test('recurrence instance retains its Google identity and private fields remain hidden', () => {
  const entry = shapeGoogleEvent({...base, visibility:'private', description:'private data',location:'home',
    recurringEventId:'series_1',originalStartTime:{dateTime:'2026-11-18T09:00:00-05:00'}},'primary','owner','generation','America/Indiana/Indianapolis');
  assert.equal(entry.event_id,base.id);
  assert.equal(entry.recurring_event_id,'series_1');
  assert.equal(entry.title,'Busy');
  assert.equal(entry.description,null);
  assert.equal(entry.location,null);
});

test('all-day exclusive ends and timed midnight boundaries are correct', () => {
  assert.deepEqual(googleEntryDateKeys({allDay:true, startsOn:'2026-11-18',endsOn:'2026-11-20'}),['2026-11-18','2026-11-19']);
  assert.deepEqual(googleEntryDateKeys({allDay:false,startsAt:'2026-11-18T09:00:00-05:00',endsAt:'2026-11-19T00:00:00-05:00',timezone:'America/Indiana/Indianapolis'}),['2026-11-18']);
});

test('cancelled tombstones preserve external event ids and invalid events are ignored', () => {
  assert.equal(shapeGoogleEvent({id:'instance',status:'cancelled'},'a','b','c',null).event_id,'instance');
  assert.equal(shapeGoogleEvent({...base,end:{dateTime:'2026-11-18T08:00:00-05:00'}},'a','b','c',null),null);
});
