import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { APPROVED_HQ_ICONS } from './approved-hq-icons.mjs';
const marker='media-free-release.json';
const provider=process.env.EVENTSIBLE_CLOUDFLARE_CONTEXT==='qa'||process.env.NETLIFY==='true'||['production','preview'].includes(process.env.VERCEL_ENV);
if(!fs.existsSync(marker)){
 if(provider)throw Error('Provider release requires a prepared media-free input; run release:prepare and deploy that directory');
}else{
 const manifest=JSON.parse(fs.readFileSync(marker));
 if(manifest.version!==1 || manifest.packageName!==JSON.parse(fs.readFileSync('package.json')).name)throw Error('Release identity mismatch');
 const expected=Object.entries(APPROVED_HQ_ICONS).map(([path,sha256])=>({path,sha256}));
 if(JSON.stringify(manifest.approvedAppIcons)!==JSON.stringify(expected))throw Error('Approved HQ icon manifest mismatch');
 for(const [f,approvedSha] of Object.entries(APPROVED_HQ_ICONS)){
  if(!fs.existsSync(f) || crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')!==approvedSha)throw Error('Approved HQ icon missing or changed: '+f);
 }
 function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)])}
 for(const f of [...walk('public'),...walk('src')])if(/\.(jpe?g|webp|png|gif|mp[34]|wav|ico|avif|mov|webm|ogg|flac)$/i.test(f) && !Object.hasOwn(APPROVED_HQ_ICONS,f.replaceAll('\\','/')))throw Error('Binary media denied in release input');
 console.log('PASS: prepared release identity, pinned HQ icons and other media exclusion.');
}
