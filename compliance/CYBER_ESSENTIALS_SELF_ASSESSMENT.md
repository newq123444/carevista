# Cyber Essentials — answer-ready self-assessment

Cyber Essentials is the cheapest, fastest credential that changes conversations
with care homes, and it is a prerequisite for the NHS Assured Solutions List
(which additionally requires Cyber Essentials **Plus**).

This maps each of the five controls to what CareVista already does, what
evidence exists, and what you personally still have to do. Answers marked
**ACTION** are about your own laptop and accounts, not the product — that is
where most first-time applicants fail.

---

## Scope

Declare the scope as: the CareVista production system (Vercel frontend, Render
backend, Neon PostgreSQL), the founder's development device, and the company's
cloud accounts (GitHub, Vercel, Render, Neon, email).

Do not scope "whole organisation" more widely than that. A smaller honest scope
passes; a broad vague one fails.

---

## Control 1 — Firewalls

| Question | Answer |
|---|---|
| Are all devices protected by a firewall? | Yes — the development laptop uses the OS firewall; production has no inbound ports of its own. |
| Are services exposed to the internet? | Only HTTPS (443) on the managed platforms. The database accepts connections only from the application, over TLS. |
| Default admin passwords on firewalls changed? | No on-premise firewall exists. Router administered by the ISP with a changed password. |

**ACTION:** confirm the home router admin password is not the factory default, and that the OS firewall is on.

---

## Control 2 — Secure configuration

| Question | Answer |
|---|---|
| Unnecessary accounts removed? | Yes — `users.active` and soft delete; role-based access enforced server-side on every route. |
| Default passwords changed? | **CRITICAL ACTION.** Demo accounts with a publicly known password are enabled on the live deployment. Set `ENABLE_DEMO_ACCOUNTS=false` and rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` before any real data. |
| Unnecessary software removed? | Managed platforms; no unused services. |
| Auto-run disabled? | N/A for the platforms; enabled on the laptop. |
| Device locking? | **ACTION:** confirm the laptop locks after inactivity and requires a password or biometric. |

---

## Control 3 — Security update management

| Question | Answer |
|---|---|
| Is all software supported and licensed? | Yes — Node 20 LTS, PostgreSQL 15+, current React and Express. |
| Are updates applied within 14 days of release for high/critical? | **ACTION:** enable Dependabot on the GitHub repository. `npm audit` already runs in CI. |
| Are unsupported versions removed? | Yes. |

---

## Control 4 — User access control

| Question | Answer |
|---|---|
| Is there a user account creation process? | Yes — accounts are created by a manager; roles are assigned explicitly. |
| Are accounts unique to individuals? | Yes — no shared logins. Care notes and sign-offs record a named person. |
| Is administrative access separate? | Yes — `super_admin` and `group_admin` are distinct from `home_manager`. |
| Are admin accounts used only for admin work? | **ACTION:** confirm you do not use an admin account for routine development. |
| Is MFA in place on cloud services? | **ACTION.** Enable MFA on GitHub, Vercel, Render, Neon and the company email today. This is the single most common failure point. |
| Are passwords protected against brute force? | Yes — rate limiting on the API, bcrypt password hashing, token blacklisting on logout and password change. |

---

## Control 5 — Malware protection

| Question | Answer |
|---|---|
| Is malware protection in place? | **ACTION:** confirm Microsoft Defender (or equivalent) is enabled and updating on the laptop. |
| Are only approved applications installed? | Yes. |

---

## Evidence already in the repository

- Role guards on every route: `backend/src/middleware/auth.ts`
- Input validation and prototype-pollution guard: `backend/src/middleware/validate.ts`
- Audit trail of every clinical action: `backend/src/services/audit.service.ts`
- Refusal to start with an insecure production configuration: `backend/src/index.ts`
- CI: dependency audit, secret scanning (gitleaks), CodeQL — `.github/workflows/ci.yml`

## What to do, in order

1. Enable MFA everywhere. Today. It takes twenty minutes.
2. Turn off demo accounts and rotate the secrets.
3. Enable Dependabot.
4. Apply for Cyber Essentials (self-assessed, around £300 + VAT for a micro business).
5. Book Cyber Essentials Plus only once the basic certificate is issued.
