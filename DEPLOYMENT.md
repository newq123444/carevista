# CareVista Deployment Guide

Deploy CareVista for free using **Neon** (PostgreSQL), **Render** (backend), and **Vercel** (frontend).


---

## 1. Database - Neon (Free Tier PostgreSQL)

1. Sign up at [neon.tech](https://neon.tech) (free tier includes 0.5 GB storage)
2. Create a new project (e.g., `carevista`)
3. Copy the connection string - it looks like:
   ```
   postgresql://user:password@ep-xyz-123.us-east-2.aws.neon.tech/carevista?sslmode=require
   ```
4. Run the database migrations and seed data from your local machine:
   ```bash
   cd backend
   DATABASE_URL="your-neon-connection-string" npm run migrate
   DATABASE_URL="your-neon-connection-string" npm run seed
   DATABASE_URL="your-neon-connection-string" npm run seed:demo
   ```

This creates all tables, inserts base data, and populates demo accounts for testing.

---

## 2. Backend - Render (Free Tier Web Service)

1. Sign up at [render.com](https://render.com)
2. Connect your GitHub repository
3. Use the **Blueprint** method (recommended):
   - Go to **Blueprints** > **New Blueprint Instance**
   - Select the repo containing `render.yaml`
   - Render will auto-detect the service configuration
4. Or create a **Web Service** manually:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
5. Set environment variables:
   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your Neon connection string |
   | `JWT_SECRET` | A secure random string (auto-generated if using Blueprint) |
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `CORS_ORIGIN` | Your Vercel frontend URL (set after deploying frontend) |
6. Deploy and note your Render service URL (e.g., `https://carevista-backend.onrender.com`)

---

## 3. Frontend - Vercel (Free Tier)

1. Sign up at [vercel.com](https://vercel.com)
2. Click **Import Project** and select your GitHub repo
3. Configure the project:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** (leave default, Vite auto-detected)
   - **Output Directory:** (leave default `dist`)
4. Set environment variable:
   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | Your Render backend URL (e.g., `https://carevista-backend.onrender.com`) |
5. Deploy - Vercel will provide a URL (e.g., `https://carevista.vercel.app`)

---

## 4. Connect CORS

After both services are deployed, go back to your Render dashboard:

1. Navigate to your backend service > **Environment**
2. Set `CORS_ORIGIN` to your Vercel frontend URL (e.g., `https://carevista.vercel.app`)
3. Click **Save Changes** - the service will automatically redeploy

---

## 5. Test with Demo Accounts

Once deployed, visit your Vercel URL and log in with these demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@demo.carevista.co.uk | Demo1234! |
| Admin | admin@demo.carevista.co.uk | Demo1234! |
| Nurse | nurse@demo.carevista.co.uk | Demo1234! |
| Carer | carer@demo.carevista.co.uk | Demo1234! |
| Senior Carer | senior@demo.carevista.co.uk | Demo1234! |
| Kitchen | kitchen@demo.carevista.co.uk | Demo1234! |
| Activities | activities@demo.carevista.co.uk | Demo1234! |
| Maintenance | maintenance@demo.carevista.co.uk | Demo1234! |
| HR | hr@demo.carevista.co.uk | Demo1234! |
| Finance | finance@demo.carevista.co.uk | Demo1234! |

---

## 6. Tips and Troubleshooting

### Render Cold Starts

The free tier on Render spins down after 15 minutes of inactivity. The first request after idle will take 30-50 seconds. To mitigate this:

- Use [UptimeRobot](https://uptimerobot.com) (free) to ping your `/health` endpoint every 14 minutes
- This keeps the service warm and responsive

### Custom Domains

- **Vercel:** Go to Project Settings > Domains to add a custom domain
- **Render:** Go to Service Settings > Custom Domains

### Environment Variables Checklist

Make sure these are all set correctly:

**Render (backend):**
- `DATABASE_URL` - Neon connection string with `?sslmode=require`
- `JWT_SECRET` - Strong random string (32+ characters)
- `NODE_ENV` - `production`
- `PORT` - `3001`
- `CORS_ORIGIN` - Vercel frontend URL (no trailing slash)

**Vercel (frontend):**
- `VITE_API_URL` - Render backend URL (no trailing slash)

### Common Issues

- **CORS errors:** Ensure `CORS_ORIGIN` on Render matches the exact Vercel URL (including `https://`)
- **Database connection fails:** Verify the Neon connection string includes `?sslmode=require`
- **Login not working:** Run `npm run seed:demo` against your Neon database to create demo users
- **Blank page on refresh:** The `vercel.json` rewrite rule handles SPA routing - ensure it is in the `frontend/` directory
