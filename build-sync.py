from pathlib import Path
import hashlib,json,re
repo=Path(__file__).resolve().parent
positions={0:'before_character_definition',1:'after_character_definition',2:'before_author_note',3:'after_author_note',4:'at_depth',5:'before_example_messages',6:'after_example_messages',7:'outlet','before_char':'before_character_definition','after_char':'after_character_definition'}
def modern(e):
 x=e.get('extensions',{}); p=e.get('position',x.get('position',0)); p=positions.get(p,p)
 assert p in set(positions.values()),p
 delay=e.get('delay_until_recursion',False)
 return {'name':e['comment'],'enabled':e.get('enabled',not e.get('disable',False)),
 'strategy':{'type':'constant' if e.get('constant') else 'vectorized' if e.get('vectorized') else 'selective','keys':e.get('key',e.get('keys',[])),'keys_secondary':{'logic':['and_any','not_all','not_any','and_all'][e.get('selectiveLogic',0)],'keys':e.get('keysecondary',e.get('secondary_keys',[]))},'scan_depth':e.get('scan_depth') if e.get('scan_depth') is not None else 'same_as_global'},
 'position':{'type':p,'role':['system','user','assistant'][e.get('role',0)],'depth':e.get('depth',4),'order':e.get('order',e.get('insertion_order',100))},'content':e['content'],'probability':e.get('probability',100),
 'recursion':{'prevent_incoming':e.get('exclude_recursion',False),'prevent_outgoing':e.get('prevent_recursion',False),'delay_until':int(delay) if delay else None},
 'effect':{k:e.get(k) or None for k in ['sticky','cooldown','delay']}}
def build(version=None):
    card=json.loads((repo/'solaris-latest.json').read_text(encoding='utf-8-sig'))
    entries=[modern(e) for e in card['data']['character_book']['entries'] if re.search('鸣潮|索拉里斯',e['comment'])]
    assert len(entries)>=3 and len({e['name'] for e in entries})==len(entries)
    assert all(any(e['name']==name for e in entries) for name in ['鸣潮副本资料','地图静态资料 - 索拉里斯','鸣潮伴星任务资料'])
    atlas=[]
    for i in [4,8,10]:
     r=card['data']['extensions']['regex_scripts'][i];v='solarisMapHtml' if i==4 else 'SOLARIS_LOCAL_ATLAS';m=re.findall(r'const\s+'+v+r'\s*=\s*("(?:[^"\\]|\\.)*");',r['replaceString']);assert len(m)==1
     atlas.append({'id':r['id'],'name':r['scriptName'],'variable':v,'literal':m[0]})
    if version is None:
        version='content-'+hashlib.sha256(json.dumps({'entries':entries,'atlas':atlas},ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:12]
    payload={'format':'solaris-content-sync/v1','owner':'qq85316902-cloud/tga-wuwa','version':version,'entries':entries,'atlas':atlas}
    b=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode();h=hashlib.sha256(b).hexdigest();name='solaris-content-'+h[:16]+'.json'
    (repo/'dist'/name).write_bytes(b)
    manifest={'format':payload['format'],'owner':payload['owner'],'version':version,'payload':name,'sha256':h,'bytes':len(b),'entry_count':len(entries),'published_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}
    (repo/'dist/solaris-content-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False))

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--version');build(parser.parse_args().version)
