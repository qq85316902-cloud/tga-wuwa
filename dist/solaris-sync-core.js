// Pure merge logic shared by the runtime and the offline verification suite.
export const FORMAT = 'solaris-content-sync/v1';
export const OWNER = 'qq85316902-cloud/tga-wuwa';
export const META = 'solaris_content_sync';
export const ANCHORS = ['鸣潮副本资料', '地图静态资料 - 索拉里斯', '鸣潮伴星任务资料'];
export function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export async function sha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function core(entry) {
  const {name,content,strategy,position,probability,recursion,effect}=entry;
  return {name,content,strategy,position,probability,recursion,effect};
}
export function validateManifest(m) {
  if(m?.format!==FORMAT || m.owner!==OWNER || !Number.isFinite(Date.parse(m.published_at)) || typeof m.version!=='string' || !/^[a-zA-Z0-9._-]+$/.test(m.version) || !/^solaris-content-[a-f0-9]{16}\.json$/.test(m.payload) || !/^[a-f0-9]{64}$/.test(m.sha256) || !Number.isInteger(m.bytes) || m.bytes<1 || m.bytes>20000000 || !Number.isInteger(m.entry_count) || m.entry_count<3 || m.entry_count>1500) throw new Error('更新清单格式不符');
  return m;
}
export function validatePayload(p,m) {
  if(p?.format!==FORMAT || p.owner!==OWNER || p.version!==m.version || !Array.isArray(p.entries) || p.entries.length!==m.entry_count || !Array.isArray(p.atlas) || p.atlas.length!==3) throw new Error('资料包格式不符');
  const names=new Set();
  for(const e of p.entries) {
    if(typeof e?.name!=='string' || !/鸣潮|索拉里斯/.test(e.name) || names.has(e.name) || typeof e.content!=='string' || !['constant','selective','vectorized'].includes(e.strategy?.type) || !Array.isArray(e.strategy.keys) || !e.strategy.keys.every(k=>typeof k==='string') || !Array.isArray(e.strategy.keys_secondary?.keys) || !e.strategy.keys_secondary.keys.every(k=>typeof k==='string') || !['and_any','and_all','not_all','not_any'].includes(e.strategy.keys_secondary.logic) || !e.position || !Number.isFinite(e.probability) || !e.recursion || !e.effect) throw new Error('资料条目无效或重名');
    names.add(e.name);
  }
  if(!ANCHORS.every(n=>names.has(n))) throw new Error('资料包缺少鸣潮识别条目');
  const ids=new Set();
  for(const a of p.atlas) {
    if(typeof a.id!=='string' || ids.has(a.id) || !['solarisMapHtml','SOLARIS_LOCAL_ATLAS'].includes(a.variable) || typeof a.literal!=='string' || typeof JSON.parse(a.literal)!=='string' || !JSON.parse(a.literal).includes('SOLARIS_META')) throw new Error('地图前端资料无效');
    ids.add(a.id);
  }
  return p;
}
export function assertBook(entries) {
  if(!Array.isArray(entries) || !ANCHORS.every(n=>entries.filter(e=>e.name===n).length===1)) throw new Error('当前主世界书不是这张鸣潮整合卡，未更新');
  const ids=new Set(); for(const e of entries){if(ids.has(e.uid))throw new Error('本地世界书UID重复'); ids.add(e.uid);}
}
export async function planWorldbook(current,remote,version) {
  assertBook(current);
  const names=new Map();for(const e of current){const list=names.get(e.name)||[];list.push(e);names.set(e.name,list);}
  const next=current.slice(), before=[], added=[], applied={}, conflicts=[];
  let uid=Math.max(0,...current.map(e=>Number(e.uid)||0))+1, changed=0;
  for(const source of remote) {
    const matches=names.get(source.name)||[];
    if(matches.length>1){conflicts.push(source.name+'（重名）');continue;}
    const existing=matches[0], incomingHash=await sha256(stable(core(source)));
    if(existing) {
      const actualHash=await sha256(stable(core(existing))), tag=existing.extra?.[META];
      if(tag?.owner===OWNER && tag.hash!==actualHash && actualHash!==incomingHash){conflicts.push(source.name);continue;}
      if(actualHash===incomingHash && tag?.owner===OWNER && tag.hash===incomingHash)continue;
      const updated={...existing,...core(source),uid:existing.uid,enabled:existing.enabled,extra:{...existing.extra,[META]:{owner:OWNER,hash:incomingHash,version}}};
      next[current.indexOf(existing)]=updated;before.push(existing);applied[source.name]=incomingHash;changed++;
    } else {
      const inserted={...source,uid:uid++,extra:{[META]:{owner:OWNER,hash:incomingHash,version}}};
      next.push(inserted);added.push(source.name);applied[source.name]=incomingHash;changed++;
    }
  }
  return {next,before,added,applied,conflicts,changed};
}
export function mapMatch(text,variable) {
  const rx=new RegExp('const\\s+'+variable+'\\s*=\\s*("(?:[^"\\\\]|\\\\.)*");','g');
  const matches=[...text.matchAll(rx)];
  if(matches.length!==1)throw new Error('地图嵌入结构不匹配：'+variable);
  JSON.parse(matches[0][1]);return matches[0];
}
export function planAtlas(regexes,atlas,previous={}) {
  const next=regexes.slice(),before=[],applied={},conflicts=[];let changed=0;
  for(const asset of atlas) {
    const matches=regexes.filter(r=>r.id===asset.id);
    if(matches.length!==1){conflicts.push(asset.name+'（正则不存在或重名）');continue;}
    const current=matches[0];let match;
    try{match=mapMatch(current.replace_string,asset.variable);}catch(e){conflicts.push(asset.name+'（地图结构不同）');continue;}
    const actual=JSON.stringify(JSON.parse(match[1])),incoming=JSON.stringify(JSON.parse(asset.literal));
    if(actual===incoming)continue;
    if(previous[asset.id] && actual!==previous[asset.id]){conflicts.push(asset.name+'（地图被本地修改）');continue;}
    // Replacement is only the string literal. Do not replace the regex or the surrounding UI/opening code.
    const updated={...current,replace_string:current.replace_string.slice(0,match.index)+match[0].replace(match[1],()=>asset.literal)+current.replace_string.slice(match.index+match[0].length)};
    next[regexes.indexOf(current)]=updated;before.push({id:current.id,variable:asset.variable,literal:match[1]});applied[asset.id]=incoming;changed++;
  }
  return {next,before,applied,conflicts,changed};
}
export async function restoreBook(current,snapshot) {
  assertBook(current);const previous=new Map(snapshot.before.map(e=>[e.name,e]));const conflicts=[];const next=[];
  for(const entry of current) {
    const expected=snapshot.applied[entry.name];
    if(!expected){next.push(entry);continue;}
    if(await sha256(stable(core(entry)))!==expected){conflicts.push(entry.name);next.push(entry);continue;}
    if(previous.has(entry.name))next.push({...previous.get(entry.name),uid:entry.uid,enabled:entry.enabled});
    else if(!snapshot.added.includes(entry.name))next.push(entry);
  }
  return {next,conflicts};
}
