(() => {
'use strict';
const host=window.parent||window, doc=host.document, KEY='__solarisScrollPerf', VERSION='2026.10.27.7';
host[KEY]?.dispose?.();
const preferences='solaris-scroll-performance-v1';
let enabled=true;try{enabled=localStorage.getItem(preferences)!=='off';}catch{}
let disposed=false, chat=null, io=null, mo=null, raf=0, updateBusy=false;
const frames=new Map(), messages=new Map(), pending=new Set(), measurePending=new Set();
const api={version:VERSION,active:false,frames:0,messages:0,registerReader,dispose};host[KEY]=api;
function lookup(name){for(const owner of [window,window.TavernHelper,host,host.TavernHelper])if(typeof owner?.[name]==='function')return owner[name].bind(owner);return null;}
function world(){for(const w of [window,host])try{const d=w.Mvu?.getMvuData?.({type:'message',message_id:'latest'})??w.getVariables?.({type:'message',message_id:'latest'});const v=(d?.stat_data||d)?.系统配置?.世界观;if(v)return String(v).trim();}catch{}return '';}
function notice(kind,message){(host.toastr||window.toastr)?.[kind]?.(message,'索拉里斯滚动优化');}
function setVisible(state,visible){
 const value=!!visible&&!doc.hidden;
 state.visible=!!visible;
 if(state.effective===value)return;state.effective=value;
 try{
  state.win.__solarisScrollVisible=value;
  if(value)state.root.removeAttribute('data-solaris-perf-paused');else state.root.setAttribute('data-solaris-perf-paused','');
  state.win.dispatchEvent(new state.win.CustomEvent('solaris-perf-visibility',{detail:{visible:value}}));
 }catch{}
}
function readerInfo(frame){
 try{const w=frame.contentWindow,d=frame.contentDocument;if(!w||!d?.body)return null;
 const reader=d.querySelector('.reading-content');const action=d.getElementById('action-raw');
 return reader||action?{win:w,document:d,reader:!!reader}:null;}catch{return null;}
}
function releaseFrame(frame,removed=false){
 const state=frames.get(frame);if(!state)return;frames.delete(frame);io?.unobserve(frame);
 try{
  state.style.remove();state.root.removeAttribute('data-solaris-perf-paused');
  if(state.hadVisible)state.win.__solarisScrollVisible=state.oldVisible;else delete state.win.__solarisScrollVisible;
  if(removed||state.win.document!==state.document){state.cleanup?.();if(state.onResize)host.removeEventListener('resize',state.onResize);}
  else if(state.reader&&state.shared){state.win.__animationObserverBound=false;state.win.initAnimationObserver?.();}
 }catch{}
 api.frames=frames.size;
}
function trackFrame(frame){
 if(!api.active||!frame?.isConnected||!chat?.contains(frame))return false;
 const info=readerInfo(frame);if(!info)return false;
 const existing=frames.get(frame);if(existing&&existing.document===info.document)return true;
 if(existing)releaseFrame(frame);
 const {win,document:d,reader}=info,root=d.documentElement,style=d.createElement('style');
 style.id='solaris-scroll-pause';
 style.textContent='html[data-solaris-perf-paused] *,html[data-solaris-perf-paused] *::before,html[data-solaris-perf-paused] *::after{animation-play-state:paused!important;}';
 d.head.appendChild(style);
 const state={win,document:d,cleanup:win.__solarisReaderCleanup,onResize:win.queueHostLayoutSync,root,style,reader,shared:!!io,visible:true,effective:null,hadVisible:Object.prototype.hasOwnProperty.call(win,'__solarisScrollVisible'),oldVisible:win.__solarisScrollVisible};
 frames.set(frame,state);
 if(reader&&io){
  win.__animationObserver?.disconnect();win.__animationMutationObserver?.disconnect();
  d.querySelectorAll('.anim-paused').forEach(e=>e.classList.remove('anim-paused'));
 }
 setVisible(state,true);io?.observe(frame);
 const text=frame.closest('.mes_text');if(text&&!messages.has(text))measurePending.add(text);
 api.frames=frames.size;return true;
}
function registerReader(w){
 if(!api.active||!io)return false;
 const f=w?.frameElement;const ok=trackFrame(f);if(ok)queue();return ok;
}
function restoreMessages(){for(const [el,old] of messages){el.classList.remove('solaris-scroll-history');if(old.value)el.style.setProperty('--solaris-message-height',old.value,old.priority);else el.style.removeProperty('--solaris-message-height');}messages.clear();api.messages=0;}
function flush(){
 raf=0;if(!api.active)return;
 const roots=[...pending];pending.clear();
 for(const root of roots){
  if(root?.matches?.('iframe'))trackFrame(root);
  root?.querySelectorAll?.('iframe').forEach(trackFrame);
 }
 for(const f of [...frames.keys()])if(!f.isConnected||!chat?.contains(f))releaseFrame(f,true);
 for(const [el,old] of messages)if(!el.isConnected||!chat?.contains(el)){el.classList.remove('solaris-scroll-history');if(old.value)el.style.setProperty('--solaris-message-height',old.value,old.priority);else el.style.removeProperty('--solaris-message-height');messages.delete(el);}
 // Read all heights before writing containment styles, avoiding per-element layout loops.
 const measures=[...measurePending].filter(el=>el.matches?.('.mes_text')&&!messages.has(el)).map(el=>({el,height:el.getBoundingClientRect().height}));measurePending.clear();
 for(const {el,height} of measures){if(!(height>0))continue;
  messages.set(el,{value:el.style.getPropertyValue('--solaris-message-height'),priority:el.style.getPropertyPriority('--solaris-message-height')});
  el.style.setProperty('--solaris-message-height',Math.ceil(height)+'px');el.classList.add('solaris-scroll-history');
 }
 api.messages=messages.size;
}
function queue(root){if(root)pending.add(root);if(!raf&&api.active)raf=window.requestAnimationFrame(flush);}
function onLoad(event){if(event.target?.tagName==='IFRAME')queue(event.target);}
function onVisibility(){for(const state of frames.values())setVisible(state,state.visible);}
let hostStyle=null;
function start(nextChat){
 chat=nextChat;api.active=true;
 hostStyle=doc.createElement('style');hostStyle.id='solaris-scroll-containment';
 hostStyle.textContent='#chat .mes_text.solaris-scroll-history{content-visibility:auto;contain-intrinsic-block-size:auto var(--solaris-message-height,600px);}';doc.head.appendChild(hostStyle);
 if(typeof host.IntersectionObserver==='function')io=new host.IntersectionObserver(entries=>{for(const e of entries){const state=frames.get(e.target);if(state)setVisible(state,e.isIntersecting);}},{root:null,rootMargin:'400px 0px',threshold:0});
 if(typeof host.MutationObserver==='function'){
  mo=new host.MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1)pending.add(node);queue();});
  mo.observe(chat,{childList:true,subtree:true});
 }
 doc.addEventListener('load',onLoad,true);doc.addEventListener('visibilitychange',onVisibility);queue(chat);
}
function stop(){
 api.active=false;if(raf)window.cancelAnimationFrame(raf);raf=0;pending.clear();measurePending.clear();mo?.disconnect();mo=null;io?.disconnect();io=null;
 for(const f of [...frames.keys()])releaseFrame(f,!f.isConnected);restoreMessages();hostStyle?.remove();hostStyle=null;
 doc.removeEventListener('load',onLoad,true);doc.removeEventListener('visibilitychange',onVisibility);chat=null;
}
function reconcile(){if(disposed)return;const desired=enabled&&['索拉里斯','鸣潮'].includes(world()),next=doc.getElementById('chat');
 if(api.active&&(!desired||chat!==next))stop();if(desired&&next&&!api.active)start(next);
}
function idle(){for(const owner of [window,window.TavernHelper,host,host.TavernHelper])if(typeof owner?.builtin?.duringGenerating==='function'){if(owner.builtin.duringGenerating()!==false)throw Error('请先停止生成，再应用显示优化。');return;}throw Error('缺少生成状态检查，未改动正则规则。');}
function currentTarget(){const fn=lookup('getCurrentCharacterId');const id=fn?.();if(id==null||id==='')throw Error('请先打开目标角色');return id;}
function sameTarget(id){if(currentTarget()!==id||!['鸣潮','索拉里斯'].includes(world()))throw Error('角色或世界观已切换，未写入。');idle();}
const PATCHES=[{"id":"3ab96f38-c15b-4e78-a7df-746653f6e35b","name":"正文美化","patches":[{"before":"    function initAnimationObserver() {\n      if (window.__animationObserverBound) return;\n      window.__animationObserverBound = true;","after":"    function initAnimationObserver() {\n      if (window.__animationObserverBound) return;\n      try {\n        if (window.parent?.__solarisScrollPerf?.registerReader(window)) {\n          window.__animationObserverBound = true;\n          return;\n        }\n      } catch (e) { }\n      window.__animationObserverBound = true;"},{"before":"        window.parent.addEventListener('resize', queueHostLayoutSync, { passive: true });\n      }\n    } catch (e) { }\n\n    function applyReadingWidth","after":"        window.parent.addEventListener('resize', queueHostLayoutSync, { passive: true });\n      }\n    } catch (e) { }\n    window.__solarisReaderCleanup = () => {\n      window.removeEventListener('resize', queueHostLayoutSync);\n      window.removeEventListener('orientationchange', queueHostLayoutSync);\n      try { window.parent?.removeEventListener('resize', queueHostLayoutSync); } catch (e) { }\n      if (hostLayoutResizeRaf) cancelAnimationFrame(hostLayoutResizeRaf);\n      hostLayoutResizeRaf = 0;\n      window.__animationObserver?.disconnect();\n      window.__animationMutationObserver?.disconnect();\n    };\n    window.addEventListener('pagehide', window.__solarisReaderCleanup, { once: true });\n\n    function applyReadingWidth"}]},{"id":"c94c30f3-b3e9-4a15-91d7-d7ad6d7d7550","name":"行动选项美化","patches":[{"before":"refresh();setInterval(refresh,1500);\ntry{var pw=window.parent||window;if(pw.eventSource&&pw.eventSource.on)pw.eventSource.on('mvu_data_updated',refresh)}catch(e){}","after":"refresh();\nvar actionTimer=null,actionObserver=null,actionHost=window.parent||window;\nvar actionPerf=actionHost.__solarisScrollPerf;\nvar actionSolaris=!!actionPerf?.active;\nif(!actionSolaris){try{var actionData=actionHost.Mvu?.getMvuData?.({type:'message',message_id:'latest'})??actionHost.getVariables?.({type:'message',message_id:'latest'});actionSolaris=['索拉里斯','鸣潮'].includes((actionData?.stat_data||actionData)?.系统配置?.世界观);}catch(e){}}\nvar actionChanged=function(){if(window.__solarisScrollVisible!==false)refresh();};\nvar actionResumed=function(e){if(e.detail?.visible)refresh();};\nif(actionSolaris&&typeof MutationObserver==='function'){\n actionObserver=new MutationObserver(actionChanged);\n if(rawNode)actionObserver.observe(rawNode,{childList:true,characterData:true,subtree:true});\n window.addEventListener('solaris-perf-visibility',actionResumed);\n}else{\n actionTimer=setInterval(refresh,1500);\n try{actionHost.eventSource?.on?.('mvu_data_updated',refresh);}catch(e){}\n}\nwindow.addEventListener('pagehide',function(){\n if(actionTimer!==null)clearInterval(actionTimer);actionObserver?.disconnect();\n window.removeEventListener('solaris-perf-visibility',actionResumed);\n try{actionHost.eventSource?.off?.('mvu_data_updated',refresh);}catch(e){}\n},{once:true});"}]}];
function transformRegexes(regexes,restoreChanges){
 const next=structuredClone(regexes),changes=[],skipped=[];
 for(const asset of PATCHES){const rows=next.filter(e=>e.id===asset.id);if(rows.length!==1){skipped.push(asset.name);continue;}
  const e=rows[0],field=typeof e.replace_string==='string'?'replace_string':'replaceString';let s=e[field];
  if(typeof s!=='string'){skipped.push(asset.name);continue;}
  const own=restoreChanges?.filter(c=>c.id===e.id),steps=restoreChanges?(own||[]).slice().reverse().map(c=>({before:c.after,after:c.before})):asset.patches;
  if(!steps.length)continue;
  let candidate=s;const local=[];let conflict=false;
  for(const p of steps){
   if(!restoreChanges&&candidate.includes(p.after))continue;
   if(restoreChanges&&!candidate.includes(p.before)&&candidate.includes(p.after))continue;
   if(candidate.split(p.before).length!==2){conflict=true;break;}
   candidate=candidate.replace(p.before,()=>p.after);local.push({id:e.id,before:p.before,after:p.after});
  }
  if(conflict){skipped.push(asset.name);continue;}e[field]=candidate;changes.push(...local);
 }
 return {next,changes,skipped};
}
async function install(restore=false){
 if(updateBusy)return;updateBusy=true;
 try{
  if(!['鸣潮','索拉里斯'].includes(world()))throw Error('请在索拉里斯世界观应用优化。');idle();const id=currentTarget();
  const get=lookup('getTavernRegexes'),replace=lookup('replaceTavernRegexes');if(!get||!replace)throw Error('酒馆助手缺少角色正则接口，请更新酒馆助手。');
  const key='solaris-scroll-rules-backup-v1:'+id,original=get({type:'character',name:id});
  let saved=null;if(restore){const raw=localStorage.getItem(key);if(!raw)throw Error('当前浏览器没有本角色的滚动规则备份。');saved=JSON.parse(raw).changes;}
  const plan=transformRegexes(original,saved);sameTarget(id);
  if(!plan.changes.length){notice('info','没有需要'+(restore?'恢复':'更新')+'的规则'+(plan.skipped.length?'；保留了本地结构不同的规则。':'。'));return;}
  if(!restore){const old=localStorage.getItem(key),previous=old?JSON.parse(old).changes:[];const merged=[...previous];for(const c of plan.changes)if(!merged.some(x=>x.id===c.id&&x.before===c.before&&x.after===c.after))merged.push(c);localStorage.setItem(key,JSON.stringify({id,changes:merged}));}
  sameTarget(id);if(JSON.stringify(get({type:'character',name:id}))!==JSON.stringify(original))throw Error('规则刚被其他操作修改，未覆盖。');
  notice('success',(restore?'已准备恢复':'已准备应用')+'正文与行动选项的滚动规则'+(plan.skipped.length?'，结构不同的规则已跳过':'')+'。显示将重新加载。');
  await replace(plan.next,{type:'character',name:id});
 }catch(e){notice('error',String(e.message||e));}finally{updateBusy=false;}
}
function toggle(){enabled=!enabled;try{localStorage.setItem(preferences,enabled?'on':'off');}catch{}reconcile();notice('info',enabled?'已开启索拉里斯滚动优化。':'已暂停滚动优化，显示已恢复。');}
function dispose(){if(disposed)return;disposed=true;stop();clearInterval(timer);host.eventSource?.off?.('mvu_data_updated',reconcile);window.removeEventListener('pagehide',dispose);if(host[KEY]===api)delete host[KEY];}
const timer=setInterval(reconcile,3000);host.eventSource?.on?.('mvu_data_updated',reconcile);window.addEventListener('pagehide',dispose,{once:true});
if(typeof eventOn==='function'&&typeof getButtonEvent==='function'){
 eventOn(getButtonEvent('应用旧卡滚动优化'),()=>install(false));eventOn(getButtonEvent('恢复旧卡滚动规则'),()=>install(true));eventOn(getButtonEvent('暂停／开启滚动优化'),toggle);
}
reconcile();
})();
