# Add Products — the shared stock-entry page for RetailOS Pro

A page several people open on their phones, on the shop's own Wi-Fi, to add
products to the shop's catalogue at the same time. Photo taken on the spot,
barcode checked as it is typed.

This repository is the source. The page itself is served by the shop's own
system — see **How staff use it** below.

---

## بەکارهێنان — بەخێرایی (Kurdish quick start)

١. لە کۆمپیوتەری فرۆشگا، سیستەمی RetailOS Pro بکەوە. دەبێت کارا بێت.
٢. مۆبایلەکەت بخە سەر هەمان Wi-Fi ی فرۆشگا.
٣. لە مۆبایل، ئەم ناونیشانە بکەوە:

```
http://192.168.1.50:8000/add
```

(ژمارەکە بگۆڕە بۆ ناونیشانی کۆمپیوتەری فرۆشگا — بڕوانە خوارەوە.)

٤. بە هەژماری خۆت بچۆ ژوورەوە — هەمان ئیمەیل و وشەی نهێنی وەکو لە کۆمپیوتەر.
   بۆ زیادکردنی کاڵا، ڕۆڵی **کۆگا** یان **ئەدمین** پێویستە.
٥. یەکەم شت **بارکۆد** بنووسە. ئەگەر کاڵا پێشتر هەبێت، خۆی پیشانت دەدات.

---

## How staff use it

The shop's system serves this page itself. Nothing to install on the phone.

```
http://<the shop PC's IP>:8000/add
```

To find the IP: on the shop computer press **Windows + R**, type `cmd`, then
type `ipconfig` and read the **IPv4 Address** — usually something like
`192.168.1.50`.

Everyone has to be on the same router as the shop computer, and the shop's
system has to be running. Adding a product needs the **warehouse** or **admin**
role; a cashier can sign in and will be told the save was refused.

Sign-in goes to Firebase, so **that one step needs internet**. Everything after
it is local.

### Why the published copy cannot be used directly

If you open this page from GitHub Pages, or from anywhere over `https://`, it
will show a card telling you to open it from the shop computer instead. That is
not a limitation of this page — no browser allows a secure `https` page to call
a plain `http` address on a local network, and it blocks the call **silently**.
The form would look fine and simply never save.

So: publish the repository if you like, but the address staff use is the shop's
own `http://…:8000/add`.

---

## What the barcode field does

This is the part worth explaining, because it is doing more than it looks.

A mistyped barcode is the worst kind of bad data in a shop: the product saves
cleanly, looks correct on every screen, and then simply never scans at the till.
Nobody connects the two, and the fix is to find the carton again.

So, as you type:

- **The check digit is verified.** Almost every retail barcode's last digit is
  computed from the others, so one wrong digit — or two swapped over — is
  arithmetically detectable. A bad code is refused before it is sent, and the
  message names the digit it should have been. Where the correction is
  unambiguous there is a button to apply it.
- **The symbology is named** — EAN-13, UPC-A, EAN-8, ITF-14 — with the GS1
  member organisation that issued the number. Shown as "issued by", not as
  origin: a prefix says who issued the number, not where the goods were made.
- **A code from the shop's own label range** (starting 02, or 20–29) is flagged
  rather than refused, and never check-digit tested. Those ranges carry no such
  obligation, and refusing them would reject labels the shop printed itself.
- **The catalogue is searched.** If the barcode already exists, the product it
  belongs to is shown with its stock on hand — because adding it again creates a
  second product the till cannot tell apart from the first.
- **Camera scanning**, where the browser allows it — see below. Where it does
  not, pressing **Scan** says why and what to do instead, rather than showing a
  dead black panel.

The arithmetic is in `barcode.js` and pinned against real barcodes:

```
node __tests__/barcode.check.mjs
```

No dependencies. Node 18 or newer.

---

## Camera scanning, and why it often will not start

Two browser rules decide this, and both catch people out:

1. A page may only use the camera in a **secure context** — `https`, or
   `localhost`. Chrome's built-in barcode reader has the same requirement.
2. **A local network address is not a secure context.** `http://192.168.1.50:8000`
   is treated exactly like any other insecure page, however private the network
   is. Nothing the page does can change that.

So on the address your staff use, a phone will refuse this page the camera —
silently. Press **Scan** and the panel now says which of the two problems it is
and what to do about it. Three ways forward, best first:

**1. A barcode scanner.** A USB or Bluetooth scanner types the digits like a
keyboard: tap the Barcode box, then scan. No camera, no permission, nothing to
configure, and faster than a phone in bad light. For a shop taking in deliveries
this is the right tool regardless.

**2. Trust the shop's address in Chrome — once per phone.** Open
`chrome://flags/#unsafely-treat-insecure-origin-as-secure`, type
`http://192.168.1.50:8000` (your own address) into the box, set it to
**Enabled**, and relaunch Chrome. The camera and the reader both work after
that. It has to be done on each phone.

**3. Read a photo.** Where the browser has the reader but will not give a live
camera, **Read a photo instead** appears in the Scan panel. It opens the phone's
own camera app — which no page permission governs — and reads the barcode off
the picture.

On an iPhone, and in Firefox, there is no built-in reader at all and no setting
adds one. Use a scanner, or type the digits — they are checked as you type, so a
typo is caught before it is saved.

---

## Photos

**Take photo** opens the rear camera directly on a phone.

Every photo is shrunk to 400px on its longest side and re-encoded as JPEG
*before it is sent* — about 20–40 KB. A phone camera produces 3–8 MB, and two
hundred of those is a database nothing can back up and a product list that takes
a minute to load. It also means the phone uploads 30 KB over the shop Wi-Fi
instead of 6 MB.

---

## Several people at once

The shop's backend handles the collision: barcode uniqueness is a database
constraint, so two people saving the same code get one success and one clear
refusal rather than a duplicate product.

What this page adds is the part that stops them colliding in the first place —
**Added from this device**, so somebody can see at a glance that the carton in
their hand was done ten minutes ago by the person across the room. With five
people working one delivery, that is where duplicates come from, and the barcode
constraint only catches the ones that share a barcode.

---

## Prices in dollars

The **Price currency** dropdown does the same thing as on the desktop: choose
USD and the floor and selling price are dollars, and the dinar price the till
charges is derived from the shop's exchange rate and follows it. The hint under
the fields shows what that works out to before you save.

**Cost is always in dinars**, whichever currency the product is priced in. It is
what the shop actually handed over, and it does not change because the rate did.

---

## Running this copy instead of the shop's

Two ways, both `http` — which is the point, because `https` cannot reach the
till (above).

**From this folder, on any PC on the same router:**

```
python serve.py
```

It prints the addresses to open, including the one to type on a phone. Point it
at the shop with the `?api=` parameter it shows you.

**Pointing at a specific shop PC:**

```
http://192.168.1.50:8080/?api=http://192.168.1.50:8000
```

By default the page talks to whichever server delivered it, which is why the
copy served at `/add` needs no configuration at all.

---

## How this relates to the main system

The shop's own copy of these files lives in the RetailOS Pro repository, in
`webadd/`, and is shipped inside the installer. **This repository is a copy.**
If you change a file here, copy it into `webadd/` there as well — nothing
synchronises them for you.

---

## Files

| | |
|---|---|
| `index.html` | the form |
| `app.js` | sign-in, saving, camera, image shrinking |
| `barcode.js` | check digits, symbology, issuer — no dependencies |
| `styles.css` | phone-first, dark, 48px controls |
| `serve.py` | optional: serve this folder from any PC on the network |
| `__tests__/barcode.check.mjs` | the barcode arithmetic, against real codes |
