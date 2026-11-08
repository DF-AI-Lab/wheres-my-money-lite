# 🤖 Claude MCP for Where's My Money? Lite: setup

Claude connects once with your **passport's Google account**. After that it can:

- ✅ read: spare cash, pots, card used/free, bills
- ✅ add a spend (paid or upcoming), a bill, a card spend, a card payment
- ✅ remove only what Claude added
- ❌ no single spends, past months, pay, Left or passcode

Changes show in the app **the next time you open it** (on your Main device).

Worker address (same Cloudflare account as TaskNotes): `https://wmm-lite.df-ai-lab-hq.workers.dev`

---

## 1️⃣ Google Cloud (project "Wheres My Money Lite")

1. https://console.cloud.google.com → project **Wheres My Money Lite**
2. **APIs & Services → Clients** → open the **web client** (the one Lite uses)
3. **Authorised redirect URIs → Add URI**:

```
https://wmm-lite.df-ai-lab-hq.workers.dev/google/callback
```

4. **Save**
5. On the same page, copy the **Client secret** (no secret shown? tap **Add secret**). Keep it private.

---

## 2️⃣ GitHub secrets

GitHub → **DF-AI-Lab/wheres-my-money-lite** → **Settings → Secrets and variables → Actions → New repository secret**

| Name | What |
|---|---|
| `CLOUDFLARE_API_TOKEN` | same one as TaskNotes ("Edit Cloudflare Workers") |
| `CLOUDFLARE_ACCOUNT_ID` | same as TaskNotes |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `TOKEN_SECRET` | 30+ random letters (make it up) |
| `ALLOWED_EMAILS` | your passport's Gmail |

---

## 3️⃣ Deploy

GitHub → **Actions → Deploy Worker** → open the latest run → **Re-run all jobs**.

Check it works: open `https://wmm-lite.df-ai-lab-hq.workers.dev` and you should see "Where's My Money? Lite Worker v0.1.0 is running".

---

## 4️⃣ Connect Claude

Try the **demo first** (fake money, safe):

1. claude.ai → **Settings → Connectors → Add custom connector**
2. Name `WMM demo`, URL:

```
https://wmm-lite.df-ai-lab-hq.workers.dev/demo/mcp
```

3. **Connect** → **Sign in with Google** (your passport's account) → tick the Drive box → done

The demo needs demo money in Drive: open `/demo/?lock=google` once and turn Drive on.

When happy, add the real one: Name `Where's My Money`, URL:

```
https://wmm-lite.df-ai-lab-hq.workers.dev/mcp
```

---

## Good to know

- Signing Claude out of every device: change `TOKEN_SECRET`, then re-run Deploy Worker.
- Tests: `node --test worker/test/*.test.js`
- The Worker never sees your scrambled backups. It only reads `wmm-summary.json` and writes `wmm-job-…json` files (Lite's inbox).
