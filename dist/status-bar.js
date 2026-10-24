// 酒馆助手只启用此入口。索拉里斯补丁与原作者源码分别维护。
const UPSTREAM_URL = 'https://cdn.jsdelivr.net/gh/tangquanghuy/dnf@latest/dist/V20261015/external-status-bar.js?v=1';
const PATCH_URL = 'https://cdn.jsdelivr.net/gh/qq85316902-cloud/tga-wuwa@37788cffef071e6dbb352ba55a406c87a293f2b2/dist/solaris-patch.json';
const host = window.parent || window;
const KEY = '__solarisStatusController';
if (host[KEY]?.dispose) host[KEY].dispose();
let disposed=false, frame=null, active='', busy=false, retryAt=0, original='', patch=null;
const api={loaderVersion:'2026.10.24.1',mode:'loading', error:'', upstreamUrl:UPSTREAM_URL, dispose};
host[KEY]=api;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const world=()=>{
  for(const win of [host,window])try{
    const raw=win.Mvu?.getMvuData?.({type:'message',message_id:'latest'}) ?? win.getVariables?.({type:'message',message_id:'latest'});
    const value=(raw?.stat_data||raw)?.系统配置?.世界观;
    if(value)return String(value).trim();
  }catch{}
  return '';
};
function notice(message){console.warn('[索拉里斯扩展]',message);host.toastr?.warning?.(message,'索拉里斯状态栏');}
async function read(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error(`下载失败 (${r.status})`);return r.text();}
function applyPatch(source, manifest){
  if(!Array.isArray(manifest?.patches)||!manifest.patches.length)throw new Error('扩展补丁为空');
  let out=source.replace(/\r\n/g,'\n');
  for(let i=0;i<manifest.patches.length;i++){
    const {before,after}=manifest.patches[i];
    if(typeof before!=='string'||!before||typeof after!=='string')throw new Error('扩展补丁格式错误');
    const pos=out.indexOf(before);
    if(pos<0||out.indexOf(before,pos+before.length)>=0)throw new Error(`原版结构变化，补丁 ${i+1} 无法安全应用`);
    out=out.slice(0,pos)+after+out.slice(pos+before.length);
  }
  return out;
}
function clearInstance(){
  if(frame){try{frame.contentWindow?.rpg_status_bar_cleanup?.();}catch{}frame.remove();frame=null;}
  host.document.getElementById('solaris-atlas-overlay')?.querySelector('button')?.click();
  for(const id of ['rpg_status_bar-toggle','rpg_status_bar-panel','rpg_status_bar-styles'])host.document.getElementById(id)?.remove();
  for(const suffix of ['cleanup','showPopup','SkillIcons','GameIcons','fetchData','refresh','setState','openTab','setTheme','setAppearance'])delete host['rpg_status_bar_'+suffix];
  host.__状态栏_loaded__=false;
}
async function mount(source){
  clearInstance();
  const f=host.document.createElement('iframe');frame=f;f.hidden=true;f.dataset.solarisStatusRuntime='1';
  host.document.body.appendChild(f);
  // A dedicated realm lets removal cancel the original script's timers and listeners.
  const bridgeKeys=['_','$','jQuery','Mvu','SillyTavern','TavernHelper','toastr','eventSource','event_types','getVariables','replaceVariables','insertOrAssignVariables','updateVariablesWith','getChatMessages','setChatMessages','getCurrentMessageId','getLastMessageId','getWorldbook','replaceWorldbook','updateWorldbookWith','getWorldbookNames','getCharWorldbookNames','getWorldInfo','getScriptId','getScriptName','getButtonEvent','eventOn','eventOnce','eventEmit','triggerSlash','triggerSlashWithResult','getTavernHelper','waitGlobalInitialized'];
  f.__solarisBridge={};for(const key of bridgeKeys){const value=window[key]??host[key];if(value!==undefined)f.__solarisBridge[key]=typeof value==='function'&&!['_','$','jQuery'].includes(key)?value.bind(window[key]!==undefined?window:host):value;}
  const bridge='Object.assign(window,window.frameElement.__solarisBridge);\n';
  f.srcdoc='<!DOCTYPE html><html><body><script>'+bridge+source.replace(/<\/script/gi,'<\\/script')+'<'+'/script></body></html>';
  for(let i=0;i<80;i++){
    if(disposed||frame!==f)return;
    if(host.__状态栏_loaded__ && host.document.getElementById('rpg_status_bar-panel') && typeof f.contentWindow?.rpg_status_bar_setState==='function'){
      for(const suffix of ['showPopup','SkillIcons','GameIcons','fetchData','refresh','setState','openTab','setTheme','setAppearance']){
        const key='rpg_status_bar_'+suffix;if(f.contentWindow[key]!==undefined)host[key]=f.contentWindow[key];
      }
      return;
    }
    await pause(100);
  }
  throw new Error('状态栏未能完成初始化');
}
async function reconcile(){
  if(disposed||busy||Date.now()<retryAt||!host.jQuery)return;
  const desired=['索拉里斯','鸣潮'].includes(world())?'solaris':'original';
  if(desired===active)return;
  busy=true;
  try{
    if(!original)original=await read(UPSTREAM_URL);
    let source=original, mode=desired, patchError='';
    if(desired==='solaris')try{
      if(!patch)patch=JSON.parse(await read(PATCH_URL));
      source=applyPatch(original,patch);
    }catch(e){patchError=e.message;mode='original-fallback';notice(patchError+'；已保留原版状态栏。');}
    if(disposed)return;
    try{await mount(source);}catch(e){
      if(desired!=='solaris'||source===original)throw e;
      patchError=e.message;mode='original-fallback';notice(patchError+'；正在恢复原版状态栏。');await mount(original);
    }
    if(disposed)return;
    active=desired;api.mode=mode;api.error=patchError;retryAt=0;
  }catch(e){api.mode='error';api.error=e.message;retryAt=Date.now()+30000;notice(e.message+'；30秒后重试。');}
  finally{busy=false;}
}
function dispose(){
  if(disposed)return;disposed=true;clearInterval(timer);
  host.eventSource?.off?.('mvu_data_updated',reconcile);
  clearInstance();if(host[KEY]===api)delete host[KEY];
}
const timer=setInterval(reconcile,1000);
host.eventSource?.on?.('mvu_data_updated',reconcile);
window.addEventListener('pagehide',dispose,{once:true});
reconcile();
