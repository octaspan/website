#!/usr/bin/env python3
"""Validate assets/i18n/<lang>.json against assets/i18n/source.en.json.
usage: validate-i18n.py <lang> [<lang>...]   (exit 1 on problems)"""
import json,re,sys,os
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','i18n')
src=json.load(open(os.path.join(root,'source.en.json'),encoding='utf8'))
tags=lambda s: re.findall(r'<[^>]+>',s)
bad=0
for lang in sys.argv[1:]:
    f=os.path.join(root,lang+'.json')
    if not os.path.exists(f): print(lang,'MISSING FILE'); bad+=1; continue
    d=json.load(open(f,encoding='utf8')); errs=[]
    for k,v in src.items():
        t=d.get(k)
        if not isinstance(t,str) or not t.strip(): errs.append((k,'missing/empty',v)); continue
        if tags(t)!=tags(v): errs.append((k,'tags differ',v))
        elif re.sub(r'<[^>]+>|&\w+;','',v).strip()==re.sub(r'<[^>]+>|&\w+;','',t).strip() and len(v)>25: errs.append((k,'identical to English?',v))
    extra=[k for k in d if k not in src]
    print(lang,len(d),'entries,',len(errs),'problems,',len(extra),'unknown ids')
    for k,m,v in errs[:15]: print('   ',k,m,'|',v[:70])
    bad+=bool(errs or extra)
sys.exit(1 if bad else 0)
