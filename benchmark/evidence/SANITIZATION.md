# Public-import sanitization

The benchmark was imported from private repository commit
`b4e8a842c003de0e809ae24ca7c21ff9537167a5` as a file snapshot without its Git
history.

The public import made these substitutions across evidence, Worker fixtures,
tests, and documentation:

- the private absolute repository path → `<repo>/benchmark`
- the private virtual-environment interpreter path → `<python>`
- the owned bot-lab hostname and related Freehold domain strings → reserved
  `example.com` hostnames
- operator-specific Worker/package names → neutral Camofox fixture names

The import also updates public-facing README and provenance text to describe the
monorepo layout and these substitutions. These changes remove local machine
layout and deployment identity. They do not change synthetic observations,
statistical outputs, source contracts, schemas, templates, or frozen fixture
bytes.

No credentials, account IDs, production cookies, customer data, real target
lists, or live browser-study results were present in the imported tree.
