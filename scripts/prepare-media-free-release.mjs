import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
const root=process.cwd();
const name=process.argv[2] || '.media-free-release';
if(!/^\.media-free-release(?:-[a-z0-9-]+)?$/.test(name)) throw Error('Destination must be a new .media-free-release directory directly inside this repository');
const out=path.resolve(root,name);
if(fs.existsSync(out)) throw Error('Destination exists; choose a new release directory');
const git=(args)=>cp.execFileSync('git',['-c','safe.directory=*',...args],{cwd:root,encoding:'utf8'}).trim();
const head=git(['rev-parse','HEAD']);
const files=git(['ls-files']).split('\n').filter(f=>!/(^|\/)\.env/.test(f));
const binary=/\.(jpe?g|webp|png|gif|mp[34]|wav|ico|avif|mov|webm|ogg|flac)$/i;
const removed=files.filter(f=>binary.test(f));
const replacements=removed.map(f=>[f.startsWith('public/')?'/'+f.slice(7):f.startsWith('src/')?'@/'+f.slice(4):null, f.startsWith('public/')?'/media-free.svg':'@/assets/media-free.svg']).filter(([a])=>a);
fs.mkdirSync(out);
for(const f of files){
 if(binary.test(f))continue;
 if(f.startsWith('.git/') || /(^|\/)\.env/.test(f)) throw Error('Unexpected private input');
 const target=path.join(out,f);if(!target.startsWith(out+path.sep))throw Error('Bad source path');
 fs.mkdirSync(path.dirname(target),{recursive:true});let bytes=fs.readFileSync(path.join(root,f));
 if(/\.(tsx?|jsx?|mjs|cjs|json|css|html)$/.test(f)&&!f.endsWith('lock.json')){
  let text=bytes.toString('utf8').split('https://eventsible.info/super-e-icon.png').join('/media-free.svg');for(const[a,b]of replacements)text=text.split(a).join(b);
  text=text.split('https://eventsible.info/super-e-icon.png').join('/media-free.svg');bytes=Buffer.from(text);
 }
 fs.writeFileSync(target,bytes);
}
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500" role="img" aria-label="Generic event illustration"><rect width="800" height="500" fill="#182638"/><path d="M80 360L240 160l140 180 100-120 220 140" fill="none" stroke="#f4c623" stroke-width="14"/><text x="400" y="440" text-anchor="middle" fill="white" font-size="24">Illustration — media-free release</text></svg>';
fs.mkdirSync(path.join(out,'public'),{recursive:true});fs.writeFileSync(path.join(out,'public/media-free.svg'),svg);
if(fs.existsSync(path.join(out,'src/assets')))fs.writeFileSync(path.join(out,'src/assets/media-free.svg'),svg);
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
fs.writeFileSync(path.join(out,'media-free-release.json'),JSON.stringify({version:1,sourceHead:head,sourceTree:git(['rev-parse','HEAD^{tree}']),packageName:JSON.parse(fs.readFileSync('package.json')).name,excludedMedia:removed.map(f=>({path:f,sha256:sha(f)})),preparedInputs:Object.fromEntries(files.filter(f=>!binary.test(f)).map(f=>[f,sha(f)]))},null,2));
console.log('Prepared media-free release input: '+name+'; '+removed.length+' binary assets excluded; originals preserved.');
