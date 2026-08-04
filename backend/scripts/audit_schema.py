#!/usr/bin/env python3
"""
Schema-drift guardrail. Parses migrations/*.sql into the authoritative schema,
then checks every SQL statement in src/ for columns/constraint-values that don't
exist. Catches the "column X does not exist" / "violates check constraint" class
before runtime. Heuristic — review flags (CTE aliases and computed AS-aliases can
show up as false positives). Run:  python3 scripts/audit_schema.py
"""
import re, glob, sys

def strip_comments(s): return re.sub(r'--[^\n]*','',s)
alltext = "\n".join(strip_comments(open(f).read()) for f in sorted(glob.glob('migrations/*.sql')))
schema, enums, checks = {}, {}, {}
for m in re.finditer(r'CREATE\s+TYPE\s+(\w+)\s+AS\s+ENUM\s*\(([^)]*)\)', alltext, re.I):
    enums[m.group(1).lower()] = set(re.findall(r"'([^']*)'", m.group(2)))
def split_top(s):
    parts=[]; d=0; cur=''
    for ch in s:
        if ch=='(':d+=1;cur+=ch
        elif ch==')':d-=1;cur+=ch
        elif ch==','and d==0:parts.append(cur);cur=''
        else:cur+=ch
    if cur.strip():parts.append(cur)
    return parts
CKW={'primary','unique','check','foreign','constraint','exclude'}
for m in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.*?)\n\)\s*;', alltext, re.I|re.S):
    t=m.group(1).lower(); cols=set()
    for seg in split_top(m.group(2)):
        seg=seg.strip()
        if not seg:continue
        f=seg.split()[0].strip('"').lower()
        if f in CKW:
            cm=re.search(r'CHECK\s*\(\s*(\w+)\s+IN\s*\(([^)]*)\)',seg,re.I)
            if cm: checks[(t,cm.group(1).lower())]=set(re.findall(r"'([^']*)'",cm.group(2)))
            continue
        cols.add(f)
        cm=re.search(r'CHECK\s*\(\s*'+re.escape(f)+r'\s+IN\s*\(([^)]*)\)',seg,re.I)
        if cm: checks[(t,f)]=set(re.findall(r"'([^']*)'",cm.group(1)))
        tk=seg.split()
        if len(tk)>=2 and tk[1].lower() in enums: checks[(t,f)]=enums[tk[1].lower()]
    schema.setdefault(t,set()).update(cols)
for m in re.finditer(r'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)', alltext, re.I):
    schema.setdefault(m.group(1).lower(),set()).add(m.group(2).lower())
for m in re.finditer(r'ALTER\s+TABLE\s+(\w+)\s+ADD\s+CONSTRAINT\s+\w+\s+CHECK\s*\(\s*(\w+)\s+IN\s*\(([^)]*)\)', alltext, re.I):
    checks[(m.group(1).lower(),m.group(2).lower())]=set(re.findall(r"'([^']*)'",m.group(3)))

KW=set('select insert update delete from where and or not null is into values set returning join left right inner outer full on as group by order having limit offset distinct count sum avg min max coalesce case when then else end true false asc desc in exists all union filter over partition interval now current_date current_timestamp extract date_trunc to_char cast nullif greatest least abs hashtext lower upper trim concat length position ilike like between using default'.split())
def sqls(t):
    return [re.sub(r'\$\{[^}]*\}','__X__',m.group(1)) for m in re.finditer(r'`([^`]*)`',t,re.S) if re.search(r'\b(SELECT|INSERT|UPDATE|DELETE)\b',m.group(1),re.I)]
def tbls(sql):
    return {m.group(1).lower() for m in re.finditer(r'\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_]\w*)',sql,re.I) if m.group(1).lower() in schema}
issues=[]
for f in glob.glob('src/**/*.ts',recursive=True):
    for sql in sqls(open(f,errors='ignore').read()):
        for m in re.finditer(r'INSERT\s+INTO\s+([a-z_]\w*)\s*\(([^)]*)\)',sql,re.I):
            t=m.group(1).lower()
            if t in schema:
                for c in [x.strip().strip('"').lower() for x in m.group(2).split(',')]:
                    if re.match(r'^[a-z_]\w*$',c) and c not in schema[t]: issues.append(f"[INSERT] {t}.{c} ({f})")
        tt=tbls(sql)
        for (t,col),allowed in checks.items():
            if t not in tt: continue
            for m in re.finditer(r'\b'+re.escape(col)+r"\s*=\s*'([^']+)'",sql):
                if m.group(1)!='__X__' and m.group(1) not in allowed: issues.append(f"[VALUE] {t}.{col}='{m.group(1)}' not in {sorted(allowed)} ({f})")
print(f"tables={len(schema)} checks={len(checks)}  flags={len(issues)}")
for i in sorted(set(issues)): print(" ",i)
sys.exit(0)
