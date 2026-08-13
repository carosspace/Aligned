# Deploying the Aligned backend on Coolify

Goal: get this server running at **https://api.animatemple.com**, so the app can log
in and back up. You'll do the clicks (I can't log into your accounts); I've made each
step exact. Roughly 15–20 minutes.

There are three parts: **A) put the code on GitHub**, **B) point the subdomain at your
server (Namecheap)**, **C) deploy it in Coolify**. Do A and B first, then C.

---

## A. Put the code on GitHub

1. On [github.com](https://github.com) → **New repository** → name it e.g. `aligned-backend`
   → **Private** → Create. Don't add a README. Copy the repo URL it shows you
   (looks like `https://github.com/YOURNAME/aligned-backend.git`).
2. On this PC, in a terminal, from the `server` folder, run (replace the URL):
   ```bash
   cd "C:\Users\ribei\Desktop\Aligned\server"
   git init
   git add .
   git commit -m "Aligned backend"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/aligned-backend.git
   git push -u origin main
   ```
   (If git asks you to sign in to GitHub, do — that's your own login.)

---

## B. Point api.animatemple.com at your server (Namecheap)

You need your server's public IP. In **Hetzner** → your server → copy its **IPv4** address.

1. [Namecheap](https://www.namecheap.com) → **Domain List** → **Manage** next to
   `animatemple.com` → **Advanced DNS**.
2. **Add New Record**:
   - Type: **A Record**
   - Host: **api**
   - Value: **your server's IPv4** (from Hetzner)
   - TTL: **Automatic**
3. Save. (DNS can take a few minutes to an hour to take effect. This does **not**
   affect your website — it only adds `api.`.)

---

## C. Deploy in Coolify

1. In Coolify → your server/project → **+ New** → **Application**.
2. Source: **Private/Public Repository (GitHub)** → connect your GitHub if asked →
   pick the `aligned-backend` repo, branch `main`.
3. **Build Pack: Dockerfile** (it will find the `Dockerfile` in the repo).
4. **Domains / FQDN:** set **`https://api.animatemple.com`**. Coolify will get a free
   HTTPS certificate automatically once DNS (part B) is live.
5. **Ports:** make sure the exposed/app port is **3000**.
6. **Persistent storage** (IMPORTANT — this is what keeps your data safe across
   restarts): add a **Volume**:
   - Name: `aligned-data`
   - Mount path (in container): **`/data`**
7. Click **Deploy**. Watch the logs until it says *"Aligned backend listening on :3000"*.

### Check it works
Open **https://api.animatemple.com/health** in a browser. You should see:
```json
{"ok":true}
```
If you see that with a valid padlock (https), the backend is live. Tell me, and I'll
repoint the app to it and rebuild — then your login + backup will work.

---

## Notes
- **Data safety:** all planner data lives in `/data/db.json` on the volume from step C6.
  Back that folder up periodically (Coolify can snapshot volumes, or copy the file).
- **Security:** PINs are hashed (bcrypt); sign-in uses random tokens, not cookies;
  PIN attempts are rate-limited. It's email + 6-digit PIN — fine for a personal planner.
  Don't reuse an important password as the PIN.
- **Updating later:** push changes to the GitHub repo and Coolify can auto-redeploy.
