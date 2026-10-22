import json, sys
from playwright.sync_api import sync_playwright
pages="about contact cookies courses index industries insights knowledge partner-form partners privacy products services terms".split()
src={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    for n in pages:
        pg=b.new_page(); pg.goto(f'http://localhost:8765/{n}.html'); pg.wait_for_timeout(300)
        r=pg.evaluate("()=>{const it=OctaspanI18n.collect();return it.map(i=>[i.id,i.key,i.kind])}")
        for id,key,kind in r:
            if id in src and src[id]['key']!=key: print('COLLISION',id)
            src.setdefault(id,{'key':key,'pages':[]})['pages'].append(n)
        pg.close()
    b.close()
out={k:v['key'] for k,v in src.items()}
json.dump(out,open('assets/i18n/source.en.json','w'),ensure_ascii=False,indent=0)
print(len(out),'strings',sum(len(v) for v in out.values()),'chars')
