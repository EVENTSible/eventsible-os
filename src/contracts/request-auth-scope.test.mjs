import test from 'node:test';
import assert from 'node:assert/strict';
import { requestAuthFetch, withRequestAuthScope } from '../lib/request-auth-scope.ts';

const url = 'https://synthetic.invalid/auth/v1/user';
const options = role => ({headers:{authorization:'Bearer synthetic-'+role,apikey:'synthetic-public'}});
test('Auth verification shares only one fresh response within each outer request', async () => {
  let calls=0;
  const read=requestAuthFetch('https://synthetic.invalid', async (_url, init) => {
    calls++;
    await new Promise(resolve=>setTimeout(resolve,2));
    return Response.json({role:new Headers(init.headers).get('authorization')});
  });
  const roles=['owner','staff'];
  await Promise.all(roles.map(role=>withRequestAuthScope(async()=>{
    const results=await Promise.all([read(url,options(role)),read(url,options(role))]);
    for(const response of results)assert.deepEqual(await response.json(),{role:'Bearer synthetic-'+role});
  })));
  assert.equal(calls,2);
  await withRequestAuthScope(()=>read(url,options('owner')));
  assert.equal(calls,3,'next request must revalidate');
  await read(url,options('owner'));await read(url,options('owner'));
  assert.equal(calls,5,'outside QA wrapper every call revalidates');
});
test('changed identities, mutations, database calls and failed verification never share a success',async()=>{
  let calls=0;
  const read=requestAuthFetch('https://synthetic.invalid',async()=>{calls++;return Response.json({}, {status:401});});
  await withRequestAuthScope(async()=>{
    await read(url,options('owner'));await read(url,options('owner'));
    await read(url,options('staff'));
    await read(url,{...options('owner'),method:'POST'});
    await read('https://synthetic.invalid/rest/v1/os_contacts',options('owner'));
    await read(new Request(url,options('owner')));
  });
  assert.equal(calls,6);
});
test('rejection and aborted callers cannot reuse an earlier verification',async()=>{
  let calls=0;
  const read=requestAuthFetch('https://synthetic.invalid',async()=>{calls++;throw Error('synthetic network failure');});
  await withRequestAuthScope(async()=>{
    await assert.rejects(read(url,options('owner')));
    await assert.rejects(read(url,options('owner')));
    await assert.rejects(read(url,{...options('owner'),signal:AbortSignal.abort()}));
  });
  assert.equal(calls,2);
});
