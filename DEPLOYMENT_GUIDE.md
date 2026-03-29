# Deployment Guide: BullionLive

This guide will teach you how to deploy the BullionLive application. Because the project consists of two distinct parts — a React (Vite) frontend and a Node.js (Express) backend (`server.ts`) — there are two main ways to approach deployment.

> [!TIP]
> **Recommended Approach:** For this project, deploying everything together on **Render** (Unified Deployment) is much easier because it requires minimal code changes and keeps everything in one place.

---

## Strategy 1: Unified Deployment (Render Only) - Recommended

This is the fastest, easiest way to get the project live. You configure your Express backend to serve the compiled frontend, so you only have to host one server.

### 1. Make the Backend Serve the Frontend
Update `server.ts` to host your built Vite files. Add this snippet right before `app.listen(port, ...)`:

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the static frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all route to serve the React application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
```

### 2. Update `package.json` Commands
Render needs to know how to build and start your app. Update the `"scripts"` section in `package.json`:

```json
"scripts": {
  "build": "vite build",
  "start": "tsx server.ts",
  // ... leave other scripts as is
}
```

### 3. Deploy to Render
1. Push your code to a GitHub repository.
2. Go to **[Render.com](https://render.com/)**, click **New → Web Service**.
3. Connect your GitHub account and select your repository.
4. Set the Configuration:
    * **Build Command:** `npm install && npm run build`
    * **Start Command:** `npm start`
5. Go to **Environment Variables** and securely add:
    * `GEMINI_API_KEY_1` = `[your key]`
6. Click **Deploy**. Render will automatically build the frontend, launch the backend, and provide a live HTTPS URL.

---

## Strategy 2: Split Deployment (Vercel + Render)

If you prefer to separate concerns (Frontend on Vercel, Backend on Render), the setup requires a few more pieces because they are hosted on different domains.

> [!WARNING]
> Because the frontend (Vercel) and backend (Render) will live on different URLs, you will face CORS (Cross-Origin Resource Sharing) issues if not configured correctly. The frontend code MUST be updated to point to the remote Render URL.

### 1. Update Frontend API Calls
Currently, `App.tsx` makes requests to `/api/analyze` and `/api/market-prices`. You must change these to use an environment variable so Vercel knows where Render lives.

In `src/App.tsx`, change `fetch('/api/analyze')` to:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || '';
const res = await fetch(`${API_BASE}/api/analyze`, { ... });
```
*(Do the same for the `/api/market-prices` fetch function in `services/marketService.ts`)*.

### 2. Deploy Backend to Render First
1. Push the repository to GitHub.
2. Go to **Render.com**, click **New → Web Service**.
3. Point to your GitHub repo.
4. Configure for Backend:
    * **Build Command:** `npm install`
    * **Start Command:** `npx tsx server.ts`
5. Add your Gemini Environment Variables.
6. Deploy and copy the live URL (e.g., `https://bullion-api.onrender.com`).

### 3. Deploy Frontend to Vercel
1. Go to **[Vercel.com](https://vercel.com/)** and click **Add New → Project**.
2. Connect the same GitHub repository.
3. Vercel will auto-detect Vite. Leave configurations as default.
4. Go to **Environment Variables** and add:
    * **Name:** `VITE_API_URL`
    * **Value:** `https://bullion-api.onrender.com` *(The exact Render URL from step 2)*
5. Click **Deploy**. Vercel will build your UI and link it to your live Render backend.
