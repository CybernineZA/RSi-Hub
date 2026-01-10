# RSi Hub

Modern Next.js + Supabase starter for **Reaper Strategic Industries (RSi)**.

## What this build includes
- Public **Join** page (`/join`) with **Discord User ID** capture
- **Discord OAuth** login (`/login`)
- **Hard gate:** users can only stay signed-in if their join application is **accepted**
- Private app (`/app`) protected by middleware
- Admin **War** page (`/app/admin/war`) with **Seed Regions + Dropoffs** button
- Admin **Destinations** page (`/app/admin/destinations`) to add/edit/delete destinations (Region + Town dropoffs) + map panel

---

## 1) Install prerequisites
- Node.js (v24 is fine)
- Git

---

## 2) Create Supabase + run the schema
1. Create a Supabase project
2. Go to **SQL Editor** and run: `supabase/schema.sql`
3. Go to **Auth → Providers → Discord** and enable it
4. In Discord OAuth redirect URLs, add:
   - `http://localhost:3000/auth/callback`

---

## 3) Create a Discord OAuth app
1. Go to the Discord Developer Portal
2. Create an application
3. Add the redirect URI:
   - `http://localhost:3000/auth/callback`
4. Copy your **Client ID** and **Client Secret** into Supabase (Auth Provider settings)

---

## 4) Configure env vars
1. Copy `ENV.example` → `.env.local`
2. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (starts with `eyJ...`)
   - `SUPABASE_SERVICE_ROLE_KEY` (**secret**, do not prefix with `NEXT_PUBLIC`)

### Optional: make yourself Commander automatically
Set these in `.env.local` before you login the first time:
- `RSI_BOOTSTRAP_DISCORD_ID=YOUR_DISCORD_USER_ID`
- `RSI_BOOTSTRAP_ROLE=commander`

---

## 5) Run locally
```bash
npm install
npm run dev
```
Open `http://localhost:3000`

---

## 6) Join + approval flow
1. Go to `/join` and submit your application (include your Discord User ID)
2. **Approve yourself** in Supabase:
   - Table: `recruit_applications`
   - Set your row `status = accepted`
3. Now go to `/login` and sign in with Discord

If you are not accepted yet, the app will sign you out and route you to `/pending`.

---

## 7) Seed Regions + Dropoffs for a War
1. Login (as commander/high command/officer)
2. Go to `/app/admin/war`
3. Create a war (or select active war)
4. Click **Seed regions + default dropoffs**
5. Go to `/app/admin/destinations` to edit/add towns and dropoff points

---

## Git ignore
This repo already includes a safe `.gitignore`. **Never commit**:
- `.env.local`
- `.env.*.local`

