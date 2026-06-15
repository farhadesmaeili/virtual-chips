# application

Use cases that orchestrate the domain. Depends only on `domain` and the port
interfaces declared here (Dependency Inversion — infrastructure implements
these ports).

- `use-cases/` — `CreateRoom`, `JoinRoom`, `PlayerAct`, `BankerSettle`, …
- `ports/` — repository / gateway interfaces implemented by infrastructure

**Allowed imports:** `domain`, `application`. No `infrastructure` or
`presentation`. (Enforced by `eslint-plugin-boundaries`.)
