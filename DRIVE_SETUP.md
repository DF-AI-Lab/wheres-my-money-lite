# Google Drive setup (do this once)

Why: so the app can keep a scrambled copy of your backup in your own Google Drive.

The "client id" you get at the end is **not a secret**. It is fine in a public repo.
The app asks for `drive.file` only: it can see **just the one file it made**, never the rest of your Drive.

## Steps

1. Go to https://console.cloud.google.com and sign in.

2. Top bar, project picker, **New project**. Name it `Wheres My Money Lite`. Click **Create**, then pick it.

3. Menu, **APIs & Services**, **Library**. Search `Google Drive API`. Click it, then **Enable**.

4. Menu, **APIs & Services**, **OAuth consent screen**.
   - User type: **External**. Click **Create**.
   - App name: `Where's My Money? Lite`.
   - User support email and developer email: your email.
   - Click **Save and continue**.

5. Scopes: click **Add or remove scopes**. Tick only
   `https://www.googleapis.com/auth/drive.file`
   (search for `drive.file`). Click **Update**, then **Save and continue**.

6. Test users: click **Add users**. Add your email and your friends' emails. **Save and continue**.
   (Or click **Publish app** later so anyone can use it.)

7. Menu, **APIs & Services**, **Credentials**. Click **Create credentials**, **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Lite web`.
   - **Authorised JavaScript origins**, **Add URI**:
     `https://df-ai-lab.github.io`
   - Add a second one for testing on your computer:
     `http://localhost:8000`
   - Click **Create**.

8. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).

9. Open `docs/demo/config.js` and paste it in (then it reaches live with the next "move to live"):

   ```js
   window.LITE_CONFIG = Object.assign({googleClientId: 'PASTE-IT-HERE.apps.googleusercontent.com'}, window.LITE_CONFIG || {});
   ```

   Or just give the client id to Claude and ask it to do this.

10. Push the change. Then in the app: Settings, **Google Drive**, **Connect Google Drive**.

Done.
