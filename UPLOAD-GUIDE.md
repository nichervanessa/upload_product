# Uploading the Add Products page to GitHub

Everything you need is in one folder, already on your PC, next to the system it
belongs to:

```
Desktop\Professional Retail POS\upload_product\
```

(Move it to the Desktop if you prefer — drag it in Explorer. Nothing depends on
where it sits. It is kept out of the main system's git repository on purpose, so
it can be its own repository.)

Read the one-minute answer first, because it changes what you do with step 4.

---

## The one thing to know before you start

**Publishing this page on GitHub Pages will not make it work.** Upload it, yes —
that is worth doing. But the address your staff use stays the shop's own:

```
http://<the shop PC's IP>:8000/add
```

Why: your shop's system speaks plain `http` on a local network address. A page
published on GitHub is delivered over `https`. No browser — Chrome, Safari,
Firefox, none — allows a secure `https` page to call a plain `http` address on a
local network. It does not warn. It blocks the request before it leaves the
phone.

That failure is nasty because it looks like nothing at all: the person signs in,
fills in a whole product, presses **Save**, and nothing happens. So the page now
checks its own address, and when it is opened over `https` it shows a card
saying "Open this from the shop computer" with the address to use instead — you
will see that card if you visit the published page, and that is correct
behaviour, not a bug.

So upload it for the reasons uploading is good — a backup off the shop PC, a
place to keep changes, somewhere to send the files from — and use the shop's own
address for the actual work.

---

## Step 1 — Get the folder

It is already on your PC at `Desktop\Professional Retail POS\upload_product`,
and delivered in the chat as `upload_product.zip` as well, if you would rather
download and unzip it somewhere else.

What is inside:

```
upload_product\
  index.html                    the form
  app.js                        sign-in, saving, camera, image shrinking
  barcode.js                    check digits, symbology, issuer
  styles.css                    phone-first, dark
  serve.py                      optional: serve the folder from any PC
  README.md                     how staff use it (with a Kurdish quick start)
  .gitignore
  __tests__\barcode.check.mjs   the barcode test
  .github\workflows\tests.yml   runs that test on every push
```

---

## Step 2 — Upload, without using any commands

This is the way to do it if you are not comfortable with the command line.
Nothing to install.

1. Open **https://github.com/nichervanessa/upload_product** and sign in.
2. If the repository is empty you will see a page saying *"uploading an existing
   file"* — click that link. If it already has files, click **Add file** →
   **Upload files**.
3. Open the `upload_product` folder. Select everything inside it
   — press **Ctrl + A** — and drag it onto the GitHub page.
4. Wait for every file to finish uploading (a list appears under the drop area).
5. In the box at the bottom, type a message: `The add-product page`.
6. Click **Commit changes**.

**Two things the drag-and-drop way misses**, because Windows Explorer hides
folders whose name starts with a dot:

- `.gitignore`
- `.github\workflows\tests.yml`

Neither is required for the page to work. If you want them:

- In Explorer, click **View** → tick **Hidden items**, then drag them too. When
  you drag the `.github` folder, GitHub keeps the folder structure.
- Or add them on the website: **Add file** → **Create new file**, and type the
  name `.github/workflows/tests.yml` — typing the slashes creates the folders —
  then paste the contents in.

---

## Step 3 — Or upload with Git, from the shop PC

Faster afterwards, because updating is then three commands.

Open **Command Prompt** and run these one at a time:

```
cd "%USERPROFILE%\OneDrive\Desktop\Professional Retail POS\upload_product"

git init
git add -A
git commit -m "The add-product page"
git branch -M main
git remote add origin https://github.com/nichervanessa/upload_product.git
git push -u origin main
```

It will ask you to sign in — a browser window opens, or it asks for a username
and a **personal access token** (your GitHub password will not work for this;
tokens are made at **github.com → Settings → Developer settings → Personal
access tokens**).

Later, when you change something, only three lines:

```
git add -A
git commit -m "what you changed"
git push
```

If `git push` is refused because the repository already has a commit in it (a
README made when you created it), run this once and then push again:

```
git pull --rebase origin main
```

---

## Step 4 — Publishing it (optional, and read the warning above)

You asked to deploy it on GitHub, so here is how. Remember what it gets you: a
public link to the page that will show the "Open this from the shop computer"
card. It is a fine way to show the page exists. It is not a way for staff to add
products.

1. On the repository, click **Settings**.
2. In the left menu, click **Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Branch: **main**, folder: **/ (root)**. Click **Save**.
5. Wait a minute or two and refresh. The address will be:

```
https://nichervanessa.github.io/upload_product/
```

If you would rather not publish it at all, skip this step entirely — the page
works exactly the same for your staff either way.

### If you truly want one public address that works

There is a real way, and it is a decision, not a step: put the shop's backend
behind a secure address with a tunnel (Cloudflare Tunnel is the usual one), then
open the published page with that address:

```
https://nichervanessa.github.io/upload_product/?api=https://your-tunnel-address
```

The page already allows this — an `https` API is let through on purpose. But
understand what it means: your till's API becomes reachable from the internet
rather than only from your shop's Wi-Fi. Everything still needs a valid staff
sign-in, but the door is in a different place. I would not do it to save typing
an IP address. Tell me if you want it and I will set it up properly.

---

## Step 5 — What to tell your five people

Send them this, and nothing else:

> On the shop Wi-Fi, open this on your phone:
> **http://192.168.1.50:8000/add**
> Sign in with your normal account. Type the barcode first — if we already have
> the product, it will tell you.

Replace `192.168.1.50` with the shop computer's address. To find it: on the shop
PC press **Windows + R**, type `cmd`, press Enter, type `ipconfig`, press Enter,
and read the **IPv4 Address**.

Worth knowing:

- The **shop's system must be running** on that PC. If it is closed, the page
  will not open.
- **Adding a product needs the warehouse or admin role.** A cashier can sign in
  and will be told the save was refused — the shop's system decides that, not
  the page.
- **Sign-in needs internet** (it goes to Firebase, the same as the desktop and
  the phone app). Everything after signing in is local.
- The address is worth saving to the phone's home screen: in Chrome, menu →
  **Add to Home screen**.
- If the shop PC's address changes when the router restarts, the link changes
  too. Ask your router for a **static/reserved IP** for the shop PC and it never
  will again.

---

## Two copies of the same files

The shop's own copy of this page lives inside the main system, at `webadd\`, and
ships inside the installer. **This repository is a second copy.** If you edit a
file in one place, copy it to the other — nothing synchronises them.

The main system's copy is the one your staff actually load. The published one is
for keeping and sharing.
