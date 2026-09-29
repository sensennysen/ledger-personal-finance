# Edit the ticket CSVs with a round-trip check
The ticket CSVs mix line endings (`epic-0`, `epic-1` and `epic-5` are LF; the rest are CRLF), quote multi-line fields, and have no BOM. A hand edit or a default `csv.DictWriter` rewrites every line.
**Why:** LED-121 changed 34 statuses across 3 files. A CRLF/LF flip would have made the diff show every row as changed and hidden the real edits.
**How:**
1. Read the file as bytes and detect the line ending from the first line. Read with `csv.DictReader(io.StringIO(text, newline=''))`.
2. Before editing, write the untouched rows back with `DictWriter(lineterminator=<detected>)` and assert the bytes equal the original. If they differ, stop and find out why.
3. Edit fields in memory and assert each string replacement matches exactly once.
4. After writing, re-run the round trip on every CSV: 20 columns, no BOM, same line ending as `git show HEAD:<file>`, and `git diff --stat` shows only the intended rows.
5. Stage files by name. `git add <directory>` also stages untracked files in it (a planning retro went in this way once and had to be unstaged).
