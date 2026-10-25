import { OWNER, META, ANCHORS, stable, sha256, core, validateManifest, validatePayload, assertBook, planWorldbook, planAtlas, mapMatch, restoreBook } from './solaris-sync-core.js';

const ROOT='https://raw.githubusercontent.com/qq85316902-cloud/tga-wuwa/main/dist/';
const CDN='https://cdn.jsdelivr.net/gh/qq85316902-cloud/tga-wuwa@main/dist/';
const host=window.parent||window, KEY='__solarisContentSync';
if(host[KEY]?.dispose)host[KEY].dispose();
let disposed=false,busy=false,epoch=0,lastError='',retryAt=0;
const checked=new Set(), subscriptions=[], helperGenerations=new Set();
const api={version:'2026.10.25.5',mode:'waiting',error:'',updated:0,conflicts:[],check:()=>check(true),generationState,restore,dispose};host[KEY]=api;
function lookup(name){for(const owner of [window,window.TavernHelper,host,host.TavernHelper])if(typeof owner?.[name]==='function')return owner[name].bind(owner);return null;}
function required(name){const f=lookup(name);if(!f)throw new Error('酒馆助手缺少 '+name+'，请更新酒馆助手');return f;}
function currentWorld(){for(const w of [window,host])try{const v=w.Mvu?.getMvuData?.({type:'message',message_id:'latest'})??w.getVariables?.({type:'message',message_id:'latest'});const name=(v?.stat_data||v)?.系统配置?.世界观;if(name)return String(name).trim();}catch{}return '';}
function generationState(){
  // The builtin reports the current host state. Do not latch GENERATION_STARTED:
  // token counting/dry runs and early aborts need not emit a matching end event.
  for(const owner of [host.TavernHelper,host,window.TavernHelper,window]){
    const builtin=owner?.builtin;if(typeof builtin?.duringGenerating!=='function')continue;
    const active=builtin.duringGenerating();
    if(typeof active!=='boolean')throw new Error('生成状态接口返回类型异常，请更新酒馆助手；本次未更新。');
    return {host:active,helper:helperGenerations.size,active:active||helperGenerations.size>0};
  }
  throw new Error('酒馆助手缺少生成状态检查，请更新酒馆助手');
}
function isGenerating(){return generationState().active;}
function target(){const id=required('getCurrentCharacterId')();const book=required('getCharWorldbookNames')('current')?.primary;return id&&book?{id,book,key:id+'|'+book}:null;}
function assertActive(t,token){const now=target();if(disposed||epoch!==token||!now||now.key!==t.key||!['鸣潮','索拉里斯'].includes(currentWorld())||isGenerating())throw new Error('聊天或生成状态已改变，本次同步中止，可稍后重试');}
function toast(kind,text){(host.toastr||window.toastr)?.[kind]?.(text,'鸣潮资料更新');}
function report(e){api.mode='error';api.error=String(e.message||e);retryAt=Date.now()+60000;if(lastError!==api.error){toast('warning',api.error);console.warn('[鸣潮资料更新]',e);lastError=api.error;}}
async function db(){return new Promise((resolve,reject)=>{const request=indexedDB.open('solaris-content-sync',1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('无法保存更新前备份，未开始写入'));});}
async function storage(key,value){const d=await db();try{return await new Promise((resolve,reject)=>{const tx=d.transaction('state',value===undefined?'readonly':'readwrite');const store=tx.objectStore('state');const req=value===undefined?store.get(key):store.put(value,key);let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('本地备份存储失败'));tx.onabort=()=>reject(new Error('本地备份事务已取消'));});}finally{d.close();}}
async function readAt(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!r.ok)throw new Error('下载失败：HTTP '+r.status);return new Uint8Array(await r.arrayBuffer());}finally{clearTimeout(timer);}}
async function download(){
  let error,manifest;
  for(const root of [ROOT,CDN])try{manifest=validateManifest(JSON.parse(new TextDecoder().decode(await readAt(root+'solaris-content-manifest.json?t='+Date.now()))));break;}catch(e){error=e;}
  if(!manifest)throw error;
  // Once a manifest is selected, both mirrors must supply that exact immutable payload.
  for(const root of [ROOT,CDN])try{const bytes=await readAt(root+manifest.payload);if(bytes.byteLength!==manifest.bytes||await sha256(bytes)!==manifest.sha256)throw new Error('资料包校验失败，保留本地资料');return {manifest,payload:validatePayload(JSON.parse(new TextDecoder().decode(bytes)),manifest)};}catch(e){error=e;}
  throw error;
}
async function locked(key,fn){if(navigator.locks?.request)return navigator.locks.request('solaris-content-sync:'+key,{ifAvailable:true},lock=>lock?fn():undefined);return fn();}
async function run(t,manual,token){
  let state=await storage(t.key)||{};
  if(state.paused&&!manual){api.mode='paused';checked.add(t.key);return;}
  assertActive(t,token);
  const {manifest,payload}=await download();assertActive(t,token);
  if(state.published_at && Date.parse(manifest.published_at)<Date.parse(state.published_at)){api.mode='current';checked.add(t.key);if(manual)toast('info','下载节点尚未刷新，已保留本地较新资料。');return;}
  const original=await required('getWorldbook')(t.book);assertBook(original);
  const wb=await planWorldbook(original,payload.entries,manifest.version);assertActive(t,token);
  const getRegex=lookup('getTavernRegexes'),replaceRegex=lookup('replaceTavernRegexes');
  if(!getRegex||!replaceRegex)throw new Error('酒馆助手缺少角色正则接口，未更新；请更新酒馆助手');
  const regexes=getRegex({type:'character',name:t.id});
  const atlas=planAtlas(regexes,payload.atlas,state.atlasBaseline||{});
  api.conflicts=[...wb.conflicts,...atlas.conflicts];
  if(wb.changed||atlas.changed){
    const backup={version:manifest.version,time:new Date().toISOString(),before:wb.before,added:wb.added,applied:wb.applied,atlasBefore:atlas.before,atlasApplied:atlas.applied};
    state={...state,backup,paused:false};await storage(t.key,state);assertActive(t,token);
    if(wb.changed)await required('updateWorldbookWith')(t.book,current=>{
      assertActive(t,token);if(stable(current)!==stable(original))throw new Error('世界书在同步期间被修改，未覆盖，请重试');return wb.next;
    },{render:'debounced'});
    assertActive(t,token);
    // Verify the data write. A failed map write can be retried independently on the next refresh.
    if(wb.changed){const saved=await required('getWorldbook')(t.book);for(const [name,hash] of Object.entries(wb.applied)){const e=saved.find(x=>x.name===name);if(!e||await sha256(stable(core(e)))!==hash)throw new Error('资料写入未能核实，已保留更新前备份');}}
    api.updated=wb.changed;api.mode=api.conflicts.length?'partial':'current';api.error='';lastError='';
    state={...state,version:manifest.version,published_at:manifest.published_at,paused:false};await storage(t.key,state);assertActive(t,token);
    if(atlas.changed){
      const fresh=getRegex({type:'character',name:t.id});if(stable(fresh)!==stable(regexes))throw new Error('角色正则在同步期间被修改，地图未覆盖，请重试');
      toast('success','资料已更新至 '+manifest.version+'；正在刷新地图显示。');
      // This API reloads the chat/script. It must be the final mutation in this run.
      await replaceRegex(atlas.next,{type:'character',name:t.id});return;
    }
    toast('success','已更新 '+wb.changed+' 个鸣潮资料条目（'+manifest.version+'）');
  } else {api.mode=api.conflicts.length?'partial':'current';api.error='';if(manual)toast('info',api.conflicts.length?'有本地修改被保留，请查看更新日志。':'鸣潮资料已是最新（'+manifest.version+'）');}
  const baseline={...state.atlasBaseline};for(const asset of payload.atlas){const e=regexes.find(r=>r.id===asset.id);if(!e)continue;try{const literal=JSON.stringify(JSON.parse(mapMatch(e.replace_string,asset.variable)[1]));if(literal===JSON.stringify(JSON.parse(asset.literal)))baseline[asset.id]=literal;}catch{}}
  await storage(t.key,{...state,version:manifest.version,published_at:manifest.published_at,paused:false,atlasBaseline:baseline});
  if(api.conflicts.length){toast('warning','已跳过 '+api.conflicts.length+' 处本地修改或结构差异；其他资料照常更新。');console.warn('[鸣潮资料更新] 保留的冲突条目：',api.conflicts);}
  checked.add(t.key);
}
async function check(manual=false){
  if(disposed||busy)return;
  if(!['鸣潮','索拉里斯'].includes(currentWorld())){api.mode='waiting';if(manual)toast('info','选择索拉里斯／鸣潮世界观后再检查资料。');return;}
  busy=true;
  try{if(isGenerating()){api.mode='waiting';if(manual)toast('info','请等待当前生成结束后再更新。');return;}const t=target();if(!t)return;const token=epoch;api.mode='checking';await locked(t.key,()=>run(t,manual,token));retryAt=0;}catch(e){report(e);}finally{busy=false;}
}
async function restore(){
  if(disposed||busy)return;busy=true;
  try{const t=target();if(!t)throw new Error('当前没有可恢复的角色主世界书');const token=epoch;assertActive(t,token);
    await locked(t.key,async()=>{
      const state=await storage(t.key),snapshot=state?.backup;if(!snapshot)throw new Error('本浏览器没有本卡的更新前备份');
      const original=await required('getWorldbook')(t.book),restored=await restoreBook(original,snapshot);
      const regexes=required('getTavernRegexes')({type:'character',name:t.id});
      const restoreAssets=snapshot.atlasBefore.filter(a=>{const r=regexes.find(x=>x.id===a.id);try{return r&&JSON.stringify(JSON.parse(mapMatch(r.replace_string,a.variable)[1]))===snapshot.atlasApplied[a.id];}catch{return false;}}).map(a=>({...a,name:a.id}));
      const maps=planAtlas(regexes,restoreAssets);
      await storage(t.key,{...state,paused:true});assertActive(t,token);
      await required('updateWorldbookWith')(t.book,current=>{assertActive(t,token);if(stable(current)!==stable(original))throw new Error('资料已被其他操作修改，恢复中止');return restored.next;},{render:'debounced'});
      api.mode='paused';toast('success','已恢复上次更新前资料，并暂停自动更新；点击“检查资料更新”可重新启用。');
      if(restored.conflicts.length)toast('warning','恢复时保留了 '+restored.conflicts.length+' 处后来修改的内容。');
      if(maps.changed){assertActive(t,token);await required('replaceTavernRegexes')(maps.next,{type:'character',name:t.id});}
    });
  }catch(e){report(e);}finally{busy=false;}
}
function listen(event,fn){if(!event)return;const on=lookup('eventOn');if(on){const sub=on(event,fn);if(sub?.stop)subscriptions.push(()=>sub.stop());}}
const events=window.tavern_events||host.tavern_events||{},frames=window.iframe_events||host.iframe_events||{};
// Native dry runs assemble prompts only; they are not AI requests and do not
// necessarily produce GENERATION_ENDED. A real start still cancels stale work.
listen(events.GENERATION_STARTED,(_type,_options,dryRun)=>{if(dryRun===true)return;epoch++;});
// Helper requests can be silent and overlap, so track their IDs independently.
listen(frames.GENERATION_STARTED,id=>{helperGenerations.add(id??'legacy');epoch++;});
listen(frames.GENERATION_ENDED,(_text,id)=>{helperGenerations.delete(id??'legacy');});
listen(events.GENERATION_STOPPED,id=>{helperGenerations.delete(id??'legacy');});
listen(events.CHAT_CHANGED,()=>{epoch++;helperGenerations.clear();});
const buttonEvent=lookup('getButtonEvent');if(buttonEvent){listen(buttonEvent('检查资料更新'),()=>check(true));listen(buttonEvent('恢复上次资料'),restore);}
const timer=setInterval(()=>{if(disposed||busy||Date.now()<retryAt)return;try{const t=target();if(t&&!checked.has(t.key))check();}catch{}},2000);
function dispose(){if(disposed)return;disposed=true;epoch++;clearInterval(timer);for(const off of subscriptions)off();helperGenerations.clear();if(host[KEY]===api)delete host[KEY];}
window.addEventListener('pagehide',dispose,{once:true});
check();
