# SECURITY — Security checklist

This checklist must be followed in every PR (reference: `CLAUDE.md`).

## Server-authoritative

- [ ] The chips/pot value is never taken from the client.
- [ ] All action validation happens in the server-side domain engine.

## Authorization (IDOR / Broken Access Control)

- [ ] A player only acts on their own turn (`NotYourTurnError`).
- [ ] A player cannot send an action for another user.
- [ ] Banker actions only with the banker role (`NotBankerError`).
- [ ] The checks are in the use-case, not only in the UI.

## Input validation

- [ ] All socket/API payloads are validated with Zod.
- [ ] No raw SQL with concatenation (only parameterized Prisma).

## Auth & Session

- [ ] The socket connection is authenticated on connection.
- [ ] Secrets only on the server (`.env`), not in the client bundle.
- [ ] Passwords are hashed (never plain text).

## Anti-abuse

- [ ] Rate limiting on room creation and actions.

## XSS/CSRF

- [ ] No unnecessary `dangerouslySetInnerHTML`.
- [ ] Auth.js default CSRF protection enabled.

## Reporting a vulnerability

Report vulnerabilities privately (do not open a public issue).
