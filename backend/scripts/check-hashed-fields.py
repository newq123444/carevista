#!/usr/bin/env python3
"""
Every column named in HASHED_FIELDS must actually exist.

A typo here does not fail the build and does not throw at runtime: the field
just hashes as null, forever, and the chain quietly protects less than it
claims to. That is the worst kind of bug in a system whose entire value is
being trustworthy, so it gets its own check.

Exit 0 = every hashed field exists. Exit 1 = at least one does not.
"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent

# ── Columns per table, from CREATE TABLE plus later ALTER TABLE ADD COLUMN ──
columns = {}
sql = ""
for f in sorted((root / "migrations").glob("*.sql")):
    sql += f.read_text() + "\n"

for m in re.finditer(r"CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\((.*?)\n\);", sql, re.S):
    table, body = m.group(1), m.group(2)
    cols = set()
    for line in body.split("\n"):
        line = line.strip()
        if not line or line.startswith("--") or line.startswith("CONSTRAINT"):
            continue
        cm = re.match(r"(\w+)\s+[A-Za-z]", line)
        if cm and cm.group(1).upper() not in ("PRIMARY", "UNIQUE", "CHECK", "FOREIGN", "CONSTRAINT"):
            cols.add(cm.group(1))
    columns.setdefault(table, set()).update(cols)

for m in re.finditer(r"ALTER TABLE (\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?(\w+)", sql):
    columns.setdefault(m.group(1), set()).add(m.group(2))
# Multi-column ALTER ... ADD COLUMN a, ADD COLUMN b
for m in re.finditer(r"ALTER TABLE (\w+)([^;]*);", sql, re.S):
    for cm in re.finditer(r"ADD COLUMN (?:IF NOT EXISTS )?(\w+)", m.group(2)):
        columns.setdefault(m.group(1), set()).add(cm.group(1))

# ── The declared field lists ────────────────────────────────────────────────
src = (root / "src/services/recordChain.ts").read_text()

table_for = {}
for m in re.finditer(r"(\w+):\s*'(\w+)',", src[src.index("const SOURCE_TABLE"):src.index("const SOURCE_TABLE") + 500]):
    table_for[m.group(1)] = m.group(2)

block = src[src.index("export const HASHED_FIELDS"):src.index("export interface AppendInput")]

problems = 0
checked = 0
for em in re.finditer(r"^  (\w+):\s*\[(.*?)^  \],", block, re.S | re.M):
    entity, body = em.group(1), em.group(2)
    table = table_for.get(entity)
    if not table:
        print(f"HASHED_FIELDS has '{entity}' but SOURCE_TABLE does not map it to a table")
        problems += 1
        continue
    if table not in columns:
        print(f"SOURCE_TABLE maps '{entity}' to '{table}', which no migration creates")
        problems += 1
        continue
    names = re.findall(r"'([a-z_]+)'", body)
    names += re.findall(r"name:\s*'([a-z_]+)'", body)
    for n in set(names):
        if n in ("numeric", "time", "date", "bool", "text"):
            continue
        checked += 1
        if n not in columns[table]:
            print(f"{entity}: hashed field '{n}' does not exist on table '{table}'")
            problems += 1

if problems:
    print(f"\n{problems} problem(s). A hashed field that does not exist hashes as null forever.")
    sys.exit(1)
print(f"All {checked} hashed fields exist on their tables.")
