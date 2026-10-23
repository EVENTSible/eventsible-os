import fs from 'node:fs';
import path from 'node:path';
const marker='media-free-release.json';
const provider=process.env.EVENTSIBLE_CLOUDFLARE_CONTEXT==='qa'||process.env.NETLIFY==='true'||process.env.VERCEL_ENV==='production';
if(!fs.existsSync(marker)){
 if(provider)throw Error('Provider release requires a prepared media-free input; run release:prepare and deploy that directory');
}else{
 const manifest=JSON.parse(fs.readFileSync(marker));
 if(manifest.version!==1 || manifest.packageName!==JSON.parse(fs.readFileSync('package.json')).name)throw Error('Release identity mismatch');
 function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)])}
 for(const f of [...walk('public'),...walk('src')])if(/\.(jpe?g|webp|png|gif|mp[34]|wav|ico|avif|mov|webm|ogg|flac)$/i.test(f))throw Error('Binary media denied in release input');
 console.log('PASS: prepared release identity and media exclusion.');
}
