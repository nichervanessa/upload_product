/**
 * Add Products — the shared stock-entry page.
 *
 * Served by the shop's own backend at http://<shop-pc>:8000/add, so anyone on
 * the same router opens it in a phone browser and starts typing. No install, no
 * build step, no second server, and — because it is the same origin as the API —
 * no CORS to configure.
 *
 * Why plain JavaScript with no framework
 * --------------------------------------
 * This has to be openable from a phone on a shop's Wi-Fi, edited by whoever
 * inherits it, and committed to GitHub without a toolchain. A build step would
 * mean node_modules on the shop PC and a compile before anyone could fix a
 * label. Three static files and no dependencies is the whole point.
 *
 * Five people at once
 * -------------------
 * The backend already handles that: barcode uniqueness is a database
 * constraint, and two people saving the same code get one success and one clear
 * refusal rather than a duplicate. What this page adds is the part that stops
 * them colliding in the first place — a live "recently added" list, so somebody
 * can see the carton in front of them has just been done by the person across
 * the room.
 */

import { inspectBarcode, groupBarcode } from "./barcode.js";

// Same origin as this page: the backend serves it. Overridable for the case of
// running the page from a laptop against a different shop PC.
const API = new URLSearchParams(location.search).get("api") || "";
const FIREBASE_KEY = "AIzaSyCedbVvDtKGhBlzKgScGmq37vIyE224zTM";   // web API key, retail-pos-ee168

const $ = (id) => document.getElementById(id);
const state = {
  idToken: localStorage.getItem("addweb_token") || "",
  refresh: localStorage.getItem("addweb_refresh") || "",
  email: localStorage.getItem("addweb_email") || "",
  categories: [],
  suppliers: [],
  rate: 1450,
  image: "",
  recent: JSON.parse(localStorage.getItem("addweb_recent") || "[]"),
};

// ─── Talking to the backend ──────────────────────────────────────────────────

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(state.idToken ? { Authorization: `Bearer ${state.idToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

  if (!res.ok) {
    // FastAPI puts the useful part in `detail`, which is sometimes a string,
    // sometimes an object, and sometimes a list of field errors. Flatten it,
    // because "[object Object]" on a phone at the back of a stockroom is
    // indistinguishable from no error message at all.
    const d = parsed?.detail;
    let message = text;
    if (typeof d === "string") message = d;
    else if (d?.message) message = d.message;
    else if (Array.isArray(d)) message = d.map(e => `${(e.loc || []).slice(-1)}: ${e.msg}`).join("; ");
    const err = new Error(message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return parsed;
}

/**
 * Sign in through the Firebase Auth REST API — the same route the phone app
 * takes, so no SDK and no CDN. This needs internet; the shop already has it for
 * activation and the relay.
 */
async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  const body = await res.json();
  if (!res.ok) {
    const code = body?.error?.message || "SIGN_IN_FAILED";
    throw new Error({
      EMAIL_NOT_FOUND: "No account with that email.",
      INVALID_PASSWORD: "Wrong password.",
      INVALID_LOGIN_CREDENTIALS: "Wrong email or password.",
      USER_DISABLED: "That account has been disabled.",
      TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Wait a minute and try again.",
    }[code] || code);
  }
  state.idToken = body.idToken;
  state.refresh = body.refreshToken;
  state.email = email;
  localStorage.setItem("addweb_token", state.idToken);
  localStorage.setItem("addweb_refresh", state.refresh);
  localStorage.setItem("addweb_email", email);
}

/**
 * An ID token lasts about an hour, and a stock-taking session lasts longer than
 * that. Without this the page starts refusing saves halfway through the evening
 * and the only clue is a 401.
 */
async function refreshToken() {
  if (!state.refresh) return false;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(state.refresh)}`,
    });
    if (!res.ok) return false;
    const body = await res.json();
    state.idToken = body.id_token;
    localStorage.setItem("addweb_token", state.idToken);
    return true;
  } catch { return false; }
}

/** Any call, retried once after a token refresh when it comes back 401. */
async function apiAuthed(path, opts) {
  try {
    return await api(path, opts);
  } catch (e) {
    if (e.status === 401 && await refreshToken()) return api(path, opts);
    throw e;
  }
}

function signOut() {
  ["addweb_token", "addweb_refresh", "addweb_email"].forEach(k => localStorage.removeItem(k));
  state.idToken = state.refresh = state.email = "";
  render();
}

// ─── Images ──────────────────────────────────────────────────────────────────

/**
 * A captured photo, shrunk to something a database can hold.
 *
 * Product images are stored as data-URLs in the product row. A phone camera
 * gives 3–8 MB per photo; 200 of those is a database nothing can back up and a
 * product list that takes a minute to load. So every capture is drawn onto a
 * canvas at 400px on its longest side and re-encoded as JPEG — 20–40 KB, which
 * is the size the desktop app has always stored.
 *
 * Done here rather than on the server on purpose: it also means the phone
 * uploads 30 KB over the shop Wi-Fi instead of 6 MB.
 */
function shrinkImage(file, maxSide = 400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      // White behind the photo: a JPEG has no transparency, and without this a
      // PNG with an alpha channel comes out with a black background.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file is not an image.")); };
    img.src = url;
  });
}

// ─── The barcode field ───────────────────────────────────────────────────────

let lookupTimer = null;

/**
 * Judge what has been typed, and say whether the shop already has it.
 *
 * Two separate questions, deliberately answered together in one line under the
 * field: is this a real barcode (arithmetic, instant, offline) and do we already
 * stock it (a lookup). Somebody holding a carton wants both before they start
 * filling in prices.
 */
function onBarcodeInput() {
  const verdict = inspectBarcode($("barcode").value);
  const box = $("barcodeNote");

  box.className = "note " + verdict.level;
  box.textContent = verdict.message;

  $("barcodeFix").hidden = !verdict.suggestion || verdict.suggestion === verdict.code;
  $("barcodeFix").textContent = verdict.suggestion
    ? `Use ${groupBarcode(verdict.suggestion)}` : "";
  $("barcodeFix").dataset.code = verdict.suggestion || "";

  clearTimeout(lookupTimer);
  $("dupe").hidden = true;
  if (!verdict.code || verdict.code.length < 6) return;

  // Debounced: this fires per keystroke while somebody types thirteen digits.
  lookupTimer = setTimeout(() => lookupBarcode(verdict.code), 350);
}

async function lookupBarcode(code) {
  try {
    const existing = await apiAuthed(`/products/barcode/${encodeURIComponent(code)}`);
    const box = $("dupe");
    box.hidden = false;
    box.innerHTML = `<b>Already in stock:</b> ${escapeHtml(existing.name)}
      — ${Number(existing.quantity || 0)} on hand.
      <span class="muted">Adding it again would create a second product with the
      same barcode, which the till cannot tell apart. Add stock to this one
      instead, on the desktop.</span>`;
  } catch (e) {
    if (e.status !== 404) return;      // 404 is the good case: it is new
    $("dupe").hidden = true;
  }
}

/**
 * Reading a barcode with the camera — and saying why, when it cannot.
 *
 * Two browser rules govern all of this, and both surprise people:
 *
 *   1. BarcodeDetector — the reader built into Chrome — exists ONLY in a secure
 *      context. So does getUserMedia, which is how a page gets at the camera.
 *   2. "Secure context" means https, or localhost. It does NOT mean a local
 *      network address: http://192.168.1.50:8000 is not secure as far as the
 *      browser is concerned, however private that network is.
 *
 * Which means that on the address the shop actually uses, a phone browser will
 * not open the camera for this page at all — and it says nothing about it. The
 * old version of this code hid the button in that case, and someone standing in
 * a stockroom was left to guess whether their phone was broken.
 *
 * So the button is always there now, and pressing it always explains the
 * situation: what is missing, and the two ways round it — pair a barcode
 * scanner (they behave as a keyboard and need no camera permission at all), or
 * mark the shop's address as trusted in Chrome, once per phone.
 *
 * When the camera IS available, this also reads a barcode out of a single
 * photo — the file input opens the phone's own camera app, which is not subject
 * to any of the above.
 */

function makeDetector() {
  if (!("BarcodeDetector" in window)) return null;
  const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf"];
  try {
    return new window.BarcodeDetector({ formats });
  } catch {
    // A browser that has the API but not all of those formats. Take its default
    // set rather than refusing to scan at all.
    try { return new window.BarcodeDetector(); } catch { return null; }
  }
}

/** Why the camera did not open, in words that say what to do next. */
function cameraErrorText(e) {
  const name = e?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "The camera was blocked. Tap the padlock or camera icon in the "
         + "browser's address bar, allow the camera, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera on this device. Type the barcode, or use a barcode "
         + "scanner — they type the digits for you.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The camera is in use by another app. Close the camera app and any "
         + "video call, then try again.";
  }
  return "The camera could not start: " + (e?.message || name || "unknown error");
}

/**
 * What to say when the browser will not give this page a camera at all.
 *
 * Both remedies are real and neither is a workaround for a bug in this page —
 * they are how browsers work. The scanner is listed first because in a shop it
 * is the better answer anyway: faster than a phone camera, works in poor light,
 * and needs no permission from anybody.
 */
function insecureContextHelp() {
  return `<b>This browser will not open the camera on this address.</b>
    A page has to be on <b>https</b> or <b>localhost</b> before any browser
    allows it a camera — a local network address like this one does not count,
    however private the network is. Nothing is broken and nothing on this page
    can change it.
    <br><br>
    Two ways to scan anyway:
    <br><br>
    <b>1. Use a barcode scanner.</b> A USB or Bluetooth scanner types the digits
    like a keyboard: tap the Barcode box first, then scan. No camera, no
    permission, and faster than a phone.
    <br><br>
    <b>2. Trust this address in Chrome</b> — once per phone. Open
    <span class="mono">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span>,
    type <span class="mono">${escapeHtml(location.origin)}</span> into the box,
    set it to <b>Enabled</b>, and relaunch Chrome. The camera works after that.
    <br><br>
    Or type the digits — they are checked as you type, so a typo is caught.`;
}

/**
 * What to say when the page IS on a secure address and there is still no reader.
 *
 * A different problem with the same symptom, and worth telling apart: iPhones,
 * Firefox and desktop Chrome on Linux have no built-in barcode reader at all, so
 * no permission and no address will produce one. Blaming the address there would
 * send somebody chasing a setting that does not exist.
 */
function noReaderHelp() {
  return `<b>This browser has no built-in barcode reader.</b>
    Chrome on Android has one; Safari on iPhone and Firefox do not, and no
    setting adds it.
    <br><br>
    <b>Use a barcode scanner instead</b> — a USB or Bluetooth one types the
    digits like a keyboard: tap the Barcode box first, then scan. It is faster
    than a phone camera and works in bad light.
    <br><br>
    Or type the digits. They are checked as you type, so a typo is caught before
    it is saved.`;
}

let scanStream = null;

function stopScan() {
  const video = $("scanVideo");
  $("scanPanel").hidden = true;
  video.pause();
  video.srcObject = null;
  scanStream?.getTracks().forEach(t => t.stop());
  scanStream = null;
}

async function startScan() {
  const panel  = $("scanPanel");
  const video  = $("scanVideo");
  const status = $("scanStatus");
  const photo  = $("scanPhotoLabel");

  // Open the panel FIRST. Everything below can fail, and a message inside an
  // open panel is read; a toast that appears and vanishes behind a keyboard is
  // not. This is also why the old version looked like a dead camera: the panel
  // only appeared after the camera had already started.
  panel.hidden = false;
  video.hidden = true;
  photo.hidden = true;
  status.className = "scanStatus";
  status.textContent = "Starting the camera…";

  // No reader at all has two quite different causes, and telling them apart is
  // the difference between a person changing a setting that helps and chasing
  // one that does not exist.
  const detector = makeDetector();
  if (!detector) {
    status.className = "scanStatus warn";
    status.innerHTML = window.isSecureContext ? noReaderHelp() : insecureContextHelp();
    return;
  }

  // The photo route works whenever the reader itself does — the file input opens
  // the phone's camera APP, which is not governed by the camera permission this
  // page would need.
  photo.hidden = false;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.className = "scanStatus warn";
    status.innerHTML = insecureContextHelp();
    return;
  }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      // "ideal", not "exact": a laptop has only a front camera, and demanding
      // the rear one there fails outright instead of using what exists.
      video: { facingMode: { ideal: "environment" } },
    });
  } catch (e) {
    status.className = "scanStatus warn";
    status.textContent = cameraErrorText(e);
    return;
  }

  video.hidden = false;
  video.srcObject = scanStream;
  try {
    await video.play();
    status.textContent = "Point the camera at the barcode.";
  } catch {
    // Some browsers refuse to play without a gesture, even a muted stream.
    status.textContent = "Tap the picture to start the camera.";
    video.onclick = () => video.play().then(() => {
      status.textContent = "Point the camera at the barcode.";
    });
  }

  const tick = async () => {
    if (panel.hidden || !scanStream) return;
    try {
      const found = await detector.detect(video);
      if (found.length) {
        acceptScanned(found[0].rawValue);
        return;
      }
    } catch { /* a frame that could not be read; try the next one */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** A barcode came back from the camera or from a photo. */
function acceptScanned(value) {
  $("barcode").value = value;
  onBarcodeInput();
  navigator.vibrate?.(60);
  stopScan();
  toast("ok", "Scanned " + groupBarcode(value));
}

/**
 * Read a barcode out of one photo.
 *
 * This is the route that survives everything above: `capture="environment"`
 * hands the job to the phone's own camera app, so no camera permission is asked
 * of the page and no live stream is needed. It still needs the browser's reader,
 * which is the one part that cannot be worked around here.
 */
async function scanFromPhoto(file) {
  const status = $("scanStatus");
  const detector = makeDetector();
  if (!detector || !file) return;

  status.className = "scanStatus";
  status.textContent = "Reading the picture…";
  try {
    const bitmap = await createImageBitmap(file);
    const found = await detector.detect(bitmap);
    bitmap.close?.();
    if (found.length) { acceptScanned(found[0].rawValue); return; }
    status.className = "scanStatus warn";
    status.textContent = "No barcode found in that picture. Fill the frame with "
                       + "the barcode, hold steady, and try again.";
  } catch (e) {
    status.className = "scanStatus warn";
    status.textContent = "That picture could not be read: " + (e?.message || "unknown error");
  }
}

// ─── Saving ──────────────────────────────────────────────────────────────────

async function save(ev) {
  ev.preventDefault();
  const verdict = inspectBarcode($("barcode").value);
  if (!verdict.ok) {
    toast("error", verdict.message);
    return;
  }

  const currency = $("price_currency").value === "USD" ? "USD" : "IQD";
  const body = {
    name: $("name").value.trim(),
    generic_name: $("generic_name").value.trim(),
    barcode: verdict.code || null,
    description: $("description").value.trim(),
    unit: $("unit").value.trim() || "pcs",
    category_id: $("category_id").value ? Number($("category_id").value) : null,
    supplier_id: $("supplier_id").value ? Number($("supplier_id").value) : null,
    purchase_price: Number($("purchase_price").value) || 0,
    limit_price: Number($("limit_price").value) || 0,
    selling_price: Number($("selling_price").value) || 0,
    price_currency: currency,
    quantity: Number($("quantity").value) || 0,
    min_stock: Number($("min_stock").value) || 5,
    expiry_date: $("expiry_date").value || null,
    batch_number: $("batch_number").value.trim(),
    location: $("location").value.trim(),
    image_url: state.image || "",
    is_active: true,
    pack_size: Math.max(1, Number($("pack_size").value) || 1),
    loose_unit: $("loose_unit").value.trim(),
    allow_loose_sale: $("allow_loose_sale").checked,
  };

  if (!body.name) { toast("error", "A name is required."); return; }

  const button = $("saveBtn");
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const created = await apiAuthed("/products/", { method: "POST", body });
    remember(created);
    toast("ok", `Saved: ${created.name}`);
    resetForm({ keepSupplier: true, keepCategory: true });
    $("name").focus();
  } catch (e) {
    toast("error", e.message);
  } finally {
    button.disabled = false;
    button.textContent = "Save product";
  }
}

/**
 * The recently-added list.
 *
 * Kept per device, and shown so somebody can tell at a glance that the carton in
 * their hand was done ten minutes ago by the person across the room. Five people
 * working a delivery is where duplicates come from, and the barcode constraint
 * catches only the ones that share a barcode.
 */
function remember(product) {
  state.recent.unshift({
    id: product.id,
    name: product.name,
    barcode: product.barcode || "",
    at: new Date().toISOString(),
    by: state.email,
  });
  state.recent = state.recent.slice(0, 40);
  localStorage.setItem("addweb_recent", JSON.stringify(state.recent));
  renderRecent();
}

function renderRecent() {
  const list = $("recent");
  if (!state.recent.length) {
    list.innerHTML = `<p class="muted">Nothing added from this device yet.</p>`;
    return;
  }
  list.innerHTML = state.recent.map(r => `
    <div class="row">
      <span class="grow">${escapeHtml(r.name)}</span>
      <span class="mono muted">${escapeHtml(groupBarcode(r.barcode)) || "—"}</span>
      <span class="muted">${new Date(r.at).toLocaleTimeString()}</span>
    </div>`).join("");
}

function resetForm({ keepSupplier = false, keepCategory = false } = {}) {
  const supplier = $("supplier_id").value;
  const category = $("category_id").value;
  $("productForm").reset();
  if (keepSupplier) $("supplier_id").value = supplier;
  if (keepCategory) $("category_id").value = category;
  state.image = "";
  $("preview").hidden = true;
  $("preview").src = "";
  $("barcodeNote").textContent = "";
  $("barcodeNote").className = "note";
  $("barcodeFix").hidden = true;
  $("dupe").hidden = true;
  $("pack_size").value = 1;
  $("min_stock").value = 5;
  updateCurrencyHint();
}

// ─── Chrome ──────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let toastTimer = null;
function toast(kind, message) {
  const el = $("toast");
  el.className = "toast " + kind;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, kind === "error" ? 7000 : 3000);
}

function updateCurrencyHint() {
  const usd = $("price_currency").value === "USD";
  const sell = Number($("selling_price").value) || 0;
  $("currencyHint").textContent = usd
    ? `Priced in dollars. At ${state.rate.toLocaleString()} the till will charge `
      + `${Math.round(sell * state.rate).toLocaleString()} IQD.`
    : "Cost ≤ floor ≤ selling. The floor is the lowest a cashier may sell at.";
  $("costUnit").textContent = "IQD";
  $("sellUnit").textContent = usd ? "USD" : "IQD";
  $("floorUnit").textContent = usd ? "USD" : "IQD";
}

async function loadLists() {
  try {
    const [cats, sups, cur] = await Promise.all([
      apiAuthed("/categories").catch(() => []),
      apiAuthed("/suppliers/").catch(() => []),
      apiAuthed("/currency/").catch(() => null),
    ]);
    state.categories = Array.isArray(cats) ? cats : [];
    state.suppliers = Array.isArray(sups) ? sups : [];
    if (cur?.rate > 0) state.rate = cur.rate;

    $("category_id").innerHTML = `<option value="">— none —</option>` +
      state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    $("supplier_id").innerHTML = `<option value="">— none —</option>` +
      state.suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    updateCurrencyHint();
  } catch (e) {
    toast("error", "Could not load categories and suppliers: " + e.message);
  }
}

/**
 * Refuse to pretend, when the page was opened from the published copy.
 *
 * This folder lives in two places: served by the shop's own backend, and
 * published on GitHub. Only the first can work. A page loaded over https is
 * forbidden by every browser from calling a plain http address — and the shop's
 * backend is exactly that: http, on a local IP. (Browsers make an exception for
 * localhost, which a phone across the room is not.)
 *
 * The block is silent. No error appears on the page and no response comes back
 * to report, because the request never leaves the phone. Somebody fills in a
 * whole product, presses Save, and nothing happens. So the page reads its own
 * address first and says where to go instead.
 *
 * An https API is let through deliberately: somebody who has put the backend
 * behind a real certificate or a tunnel has solved this, and ?api=https://… is
 * how they say so.
 */
function isUnreachableFromHere() {
  if (location.protocol !== "https:") return false;   // http page → http API: allowed
  if (/^https:/i.test(API)) return false;             // told to use a secure API
  return true;
}

function render() {
  if (isUnreachableFromHere()) {
    $("hosted").hidden = false;
    $("login").hidden = true;
    $("app").hidden = true;
    const who = document.querySelector("header .who-box");
    if (who) who.hidden = true;
    return;
  }
  const signedIn = Boolean(state.idToken);
  $("login").hidden = signedIn;
  $("app").hidden = !signedIn;
  $("who").textContent = state.email || "";
  if (signedIn) { loadLists(); renderRecent(); }
}

// ─── Wiring ──────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  $("loginForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const button = $("loginBtn");
    button.disabled = true;
    button.textContent = "Signing in…";
    try {
      await signIn($("email").value.trim(), $("password").value);
      render();
      toast("ok", "Signed in.");
    } catch (e) {
      toast("error", e.message);
    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  });

  $("signOut").addEventListener("click", signOut);
  $("productForm").addEventListener("submit", save);
  $("barcode").addEventListener("input", onBarcodeInput);
  $("price_currency").addEventListener("change", updateCurrencyHint);
  $("selling_price").addEventListener("input", updateCurrencyHint);

  $("barcodeFix").addEventListener("click", () => {
    const code = $("barcodeFix").dataset.code;
    if (code) { $("barcode").value = code; onBarcodeInput(); }
  });

  // The Scan button is always shown, even where the browser will refuse the
  // camera. Pressing it is how somebody finds out WHY — hiding it left a person
  // in a stockroom deciding their phone was broken.
  $("scanBtn").hidden = false;
  $("scanBtn").addEventListener("click", startScan);
  $("scanClose").addEventListener("click", stopScan);
  $("scanPhoto").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (file) await scanFromPhoto(file);
  });

  if (!("BarcodeDetector" in window)) {
    $("scanHint").textContent = "Camera scanning needs a secure address — tap "
      + "Scan to see the two ways round it. Typing the digits always works.";
  }

  $("photo").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      state.image = await shrinkImage(file);
      $("preview").src = state.image;
      $("preview").hidden = false;
      const kb = Math.round(state.image.length * 0.75 / 1024);
      $("photoNote").textContent = `Photo ready — about ${kb} KB after shrinking.`;
    } catch (e) {
      toast("error", e.message);
    }
  });

  $("clearPhoto").addEventListener("click", () => {
    state.image = "";
    $("preview").hidden = true;
    $("photoNote").textContent = "";
  });

  render();
});
