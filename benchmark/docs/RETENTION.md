# Evidence minimization, sanitization and retention

Only dummy fixture data belong in version control. Never persist cookies, storage,
auth headers, request bodies, uploads, account information, browser profiles or
secrets. Do not include raw browser/network logs or downloaded real documents.
Capture only bounded normalized text/title, status and explicit outcome signals.

Sanitize BEFORE hashing and labeling. `bench.hygiene.sanitize` strips URL query /
fragment tails, emails and common credential patterns. Apply to title/text; retain
neither raw URL tails nor discarded matches. Sanitization is deliberately limited,
not guaranteed PII/secret detection: manually review all evidence and fail closed
if unknown sensitive content appears. Do not rehash unsanitized files as a fix.
The analysis CLI refuses text changed by the sanitizer.

`python -m bench.hygiene scan .` scans every regular file under the repository
except .git/.venv/__pycache__, including ignored runs/private-evidence. It reports
relative file names only, never secret matches. Any match fails (exit 1); symlinks
and files over ten MB refuse. Patterns cover GitHub/AWS tokens, private-key markers,
long bearer values and common literal secret assignments; this is not exhaustive
DLP. Run immediately before every local commit and before any approved publication.
Do not commit raw secrets, even as "redacted" history.

Private evidence must be under ignored `private-evidence/raw/` (7 days) or
`private-evidence/sanitized/` (30 days). Use filesystem mtime as retention clock;
do not refresh mtime to extend retention. For a trusted local repository only:

```
python -m bench.hygiene purge private-evidence
python -m bench.hygiene purge private-evidence --execute
```

Default is dry-run. Deletion requires the explicit directory named
private-evidence and explicit --execute. Symlinks and unknown retention classes
refuse before any deletion. The operator schedules enforcement; no background
job is installed. Deleting files is not secure erasure, and backups/Git need their
own policy. Never place real evidence in Git; retention cannot erase history.
Retain only sanitized aggregate reports, file pins, protocol revisions and approved
deviations long-term. Current checked-in synthetic fixtures are nonpersonal and
may be retained as tests. No real study or personal evidence exists in this build.
