// 酒馆助手只启用此入口。索拉里斯补丁与原作者源码分别维护。
const UPSTREAM_URL = 'https://cdn.jsdelivr.net/gh/tangquanghuy/dnf@latest/dist/V20261015/external-status-bar.js?v=1';
const PATCH_URL = 'https://cdn.jsdelivr.net/gh/qq85316902-cloud/tga-wuwa@41018efd167c7d5e7010d68c2231d97c83754046/dist/solaris-patch.json';
const host = window.parent || window;
const KEY = '__solarisStatusController';
if (host[KEY]?.dispose) host[KEY].dispose();
let disposed=false, frame=null, active='', busy=false, retryAt=0, original='', patch=null;
const api={loaderVersion:'2026.10.25.2',storyStartConfirmation:true,mode:'loading', error:'', upstreamUrl:UPSTREAM_URL, dispose};
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

  const enemyNameCorrections=[["无音区强敌已被实际击败","无冠者已被实际击败"],["迎战强大残象并将其击溃","迎战无冠者并将其击溃"],["无音区内外分隔战斗者与观察者","无音区内外分隔无冠者战的参战者与观察者"],["利用机械敌人的关节与掉落部件将其击败","利用聚械机偶的关节弱点与掉落部件将其击败"],["地下机械敌人已击败","地下的聚械机偶已击败"],["伤痕及其异生梦魇","伤痕及其异化形态“伤痕·异生梦魇”"],["伤痕及异生梦魇的冲突","伤痕与“伤痕·异生梦魇”阶段的冲突"],["游鳞机枢被击败","游鳞机枢·凛铓被击败"],["游鳞机枢已击败","游鳞机枢·凛铓已击败"],["蚀脊龙暴君","蚀脊龙·「暴君」"],["伪作神王","伪作的神王"],["疯王卡利古拉","疯王·卡利古拉"],["击败免疫般攻击隧群","击败炉芯机骸（炉芯上具有免疫系统般攻击行为的隧群）"],["击败强敌救回秧秧","击败万囮牢救回秧秧"],["万囮牢屏障及强敌已解决","万囮牢已被击败、相应屏障已解除"],["万囮牢旁","万囮牢所在处"],["两度迎战天傀，","两度迎战天傀劫煞，"],["两战破天傀，","两战击败天傀劫煞，"],["木禺天傀被击败","木禺所附的天傀劫煞被击败"],["木禺弃肉身后仍有天傀战力","木禺弃肉身后仍以天傀劫煞形态作战"],["协力击败心魔、回收错误星图","协力击败星图核心（心魔）、回收错误星图"],["已会合并击败心魔核心","已会合并击败星图核心（心魔）"],["击败镜中自己","击败镜中的“珂莱塔”"],["处理逐渐增强的敌人","迎战残象；前段夺回星星时，与大布偶、铲子叔叔、寂寞小姐、魔术先生等布偶交战"],["敌人显出亚当·重锤形象","敌人显出梦魇亚当·重锤形象"],["梦魇在终点阻拦","梦魇亚当·重锤在终点阻拦"],["迎击梦魇是同一高潮","击败梦魇亚当·重锤是同一高潮"],["终点威胁已解除","终点的梦魇亚当·重锤已被击败"]];
  for(const [before,after] of enemyNameCorrections)out=out.split(before).join(after);
  return out;
}
function clearInstance(){
  if(frame){try{frame.contentWindow?.rpg_status_bar_cleanup?.();}catch{}frame.remove();frame=null;}
  host.document.getElementById('solaris-atlas-overlay')?.querySelector('button')?.click();
  for(const id of ['rpg_status_bar-toggle','rpg_status_bar-panel','rpg_status_bar-styles'])host.document.getElementById(id)?.remove();
  for(const suffix of ['cleanup','showPopup','SkillIcons','GameIcons','fetchData','refresh','setState','openTab','setTheme','setAppearance'])delete host['rpg_status_bar_'+suffix];
  host.__状态栏_loaded__=false;
}
function addStoryStartConfirmation(source){
  const before = "          if(replay){showPanelConfirm('<strong class=\"scenario-confirm-title\">'+(replay?'重新执行':'接取')+'《'+escapeScenarioHtml(name)+'》？</strong><span class=\"scenario-confirm-detail\">'+detail+'</span>',()=>replay?restartScenarioEntry(kind,name):activateScenarioEntry(kind,name));}else{activateScenarioEntry(kind,name).catch(error=>{log.error('索拉里斯接取失败',error);showToast('error','接取失败：'+error.message);});}";
  const after = "          showPanelConfirm('<strong class=\"scenario-confirm-title\">'+(replay?'重新执行':'确定开启')+'《'+escapeScenarioHtml(name)+'》？</strong><span class=\"scenario-confirm-detail\">'+detail+'<br>确认后发送：<b>'+escapeScenarioHtml(actionText)+'</b></span>',()=>{\n            const action=replay?restartScenarioEntry(kind,name):activateScenarioEntry(kind,name);\n            Promise.resolve(action).catch(error=>{log.error('索拉里斯接取失败',error);showToast('error','接取失败：'+error.message);});\n          });";
  if(!source.includes(before)){
    if(source.includes("if(kind.startsWith('solaris')) {")) throw new Error('剧情开启确认补丁未匹配，请更新状态栏');
    return source;
  }
  if(source.split(before).length!==2) throw new Error('剧情开启确认补丁匹配不唯一');
  return source.replace(before,after);
}
async function mount(source){
  source=addStoryStartConfirmation(source);
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
