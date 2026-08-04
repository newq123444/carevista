# CareVista v4 — God Mode Upgrade

## 🔥 What's Fixed & Added

### 🐛 Critical Bug Fixes
1. **Login now works for ALL roles** — carers, senior carers, nurses, managers all redirect correctly after login
2. **Demo accounts all work** — every quick-login button on the login screen now logs you in and takes you to the right dashboard
3. **Role-based dashboard routing** — `Dashboard.tsx` correctly maps every role to the right view:
   - `home_manager`, `deputy_manager`, `super_admin`, `group_admin` → Manager Dashboard
   - `registered_nurse` → Nurse Dashboard  
   - `carer`, `senior_carer`, `activities` → Carer Dashboard (was broken before)
   - `finance`, `admin` → Finance Dashboard
4. **Bearer token auth fixed** — auth store now correctly stores JWT in localStorage and injects it into every API call

---

### 🚀 God-Mode New Features

#### 🔐 Login Page (complete rebuild)
- Beautiful two-panel design — branding on left, login on right
- **7 quick-demo role cards** with one-click login (no password typing)
- Real-time loading state per card — can't click multiple at once
- Password show/hide toggle
- Feature highlights, compliance badge

#### ❤️ Carer Dashboard (super interactive)
- **3-step note wizard**: Select Resident → Select Type → Fill In Details
- **Visual resident grid** with risk colour coding, DNACPR flags, room numbers
- **8 note categories** with dedicated icons and colours
- **Quick Prompts** — tap to add pre-written text into the note body instantly
- **Mood selector** — 6 mood options with emoji (Happy/Neutral/Low/Agitated/Drowsy/Confused)
- **Food intake selector** — None/¼/½/¾/Full (for nutrition notes)
- **Fluid intake selector** — 100ml → 500ml buttons (for fluid chart notes)
- **Visual pain scale** — 0–10 with colour gradient (green → red → purple)
- **Flag toggle** — toggle switch to flag for senior/manager review
- **Live clock + shift indicator** — Day/Evening/Night auto-detected with colour
- Quick nav pills to Care Notes, Residents, Handover, Schedule

#### 🗂️ New Pages Created
- `/login` — God-mode unified login
- `/residents` — Full list with risk filters, search, visual cards
- `/residents/:id` — Resident detail with clinical info
- `/incidents` — Full incident list + inline create form
- `/schedule` — Week rota grid view with shift colour coding
- `/staff` — Staff cards with DBS expiry warnings
- `/training` — Training records table with status filters + add form
- `/policies` — Policy library with category filter
- `/profile` — User profile + sign out

#### 🏗️ Infrastructure Created
- `src/store/auth.store.ts` — Zustand auth store with Bearer token
- `src/services/api.ts` — Centralised Axios API client
- `src/types/index.ts` — Full TypeScript types for all entities
- `src/utils/formatters.ts` — Date, currency, label formatters
- `src/utils/toast.ts` — Lightweight toast notification system
- `src/hooks/index.ts` — 30+ React Query hooks for every API endpoint
- `tsconfig.json` — TypeScript configuration
- `vite.config.ts` — Vite configuration with dev proxy

---

## 🔑 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Home Manager | manager@demo.carevista.co.uk | Demo1234! |
| Deputy Manager | deputy@demo.carevista.co.uk | Demo1234! |
| Registered Nurse | nurse@demo.carevista.co.uk | Demo1234! |
| Senior Carer | senior@demo.carevista.co.uk | Demo1234! |
| Care Assistant | carer1@demo.carevista.co.uk | Demo1234! |
| Activities | activities@demo.carevista.co.uk | Demo1234! |
| Finance | finance@demo.carevista.co.uk | Demo1234! |

## 🛠️ Running the Project

```bash
# Backend
cd backend && npm install && npm run migrate && npm run seed && npm run dev

# Frontend (in another terminal)
cd frontend && npm install && npm run dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:4000`.
