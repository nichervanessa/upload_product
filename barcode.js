/**
 * Knowing what a barcode IS.
 *
 * Five people typing barcodes off cartons all evening will mistype some of
 * them, and a mistyped barcode is the worst kind of bad data in a shop: the
 * product saves cleanly, looks right on every screen, and then simply never
 * scans at the till. Nobody connects the two, and the fix is to find the carton
 * again.
 *
 * Almost every retail barcode carries a check digit for exactly this reason —
 * the last digit is computed from the ones before it, so a single wrong digit or
 * a pair swapped over is arithmetically detectable. That is what this module is
 * for. It runs before anything is sent, so a typo is caught while the carton is
 * still in someone's hand.
 *
 * No dependencies, no build step: this is loaded straight into the page and
 * imported by its test.
 */

/**
 * The GS1 check digit for a digit string.
 *
 * Weights alternate 3 and 1 from the RIGHTMOST body digit leftwards, which is
 * what makes the same routine correct for EAN-13, EAN-8, UPC-A and ITF-14
 * despite their different lengths. Written that way round deliberately: the
 * common bug is to anchor the weights at the left, which then works for
 * even-length codes and silently fails for odd ones.
 */
export function gs1CheckDigit(body) {
  const digits = String(body).split("").map(Number);
  let sum = 0;
  for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/** The symbologies we recognise, by length. */
const BY_LENGTH = {
  8:  "EAN-8",
  12: "UPC-A",
  13: "EAN-13",
  14: "ITF-14",
};

/**
 * Where a GS1 prefix says the number was ISSUED.
 *
 * Deliberately incomplete and deliberately labelled a hint. A prefix identifies
 * the GS1 member organisation that issued the number, NOT where the goods were
 * made or where they are sold — a German company can sell a product made in
 * China under a 400-prefix number. Presenting it as origin would be wrong, so it
 * is only ever shown as "issued by", and only when it is a whole clean range.
 */
function issuerHint(code) {
  const p3 = Number(code.slice(0, 3));
  if (code.length === 12) return "United States or Canada (UPC)";
  if (p3 >= 0   && p3 <= 19)  return "United States or Canada";
  if (p3 >= 300 && p3 <= 379) return "France";
  if (p3 >= 400 && p3 <= 440) return "Germany";
  if (p3 >= 500 && p3 <= 509) return "United Kingdom";
  if (p3 >= 520 && p3 <= 521) return "Greece";
  if (p3 === 528) return "Lebanon";
  if (p3 === 529) return "Cyprus";
  if (p3 === 531) return "North Macedonia";
  if (p3 === 535) return "Malta";
  if (p3 === 539) return "Ireland";
  if (p3 >= 540 && p3 <= 549) return "Belgium or Luxembourg";
  if (p3 === 560) return "Portugal";
  if (p3 === 569) return "Iceland";
  if (p3 >= 570 && p3 <= 579) return "Denmark";
  if (p3 === 590) return "Poland";
  if (p3 === 594) return "Romania";
  if (p3 === 599) return "Hungary";
  if (p3 >= 600 && p3 <= 601) return "South Africa";
  if (p3 === 603) return "Ghana";
  if (p3 === 608) return "Bahrain";
  if (p3 === 609) return "Mauritius";
  if (p3 === 611) return "Morocco";
  if (p3 === 613) return "Algeria";
  if (p3 === 616) return "Kenya";
  if (p3 === 618) return "Ivory Coast";
  if (p3 === 619) return "Tunisia";
  if (p3 === 621) return "Syria";
  if (p3 === 622) return "Egypt";
  if (p3 === 624) return "Libya";
  if (p3 === 625) return "Jordan";
  if (p3 === 626) return "Iran";
  if (p3 === 627) return "Kuwait";
  if (p3 === 628) return "Saudi Arabia";
  if (p3 === 629) return "United Arab Emirates";
  if (p3 === 640) return "Finland";
  if (p3 >= 690 && p3 <= 699) return "China";
  if (p3 >= 700 && p3 <= 709) return "Norway";
  if (p3 >= 730 && p3 <= 739) return "Sweden";
  if (p3 === 729) return "Israel";
  if (p3 === 740) return "Guatemala";
  if (p3 === 744) return "Costa Rica";
  if (p3 === 754 || p3 === 755) return "Canada";
  if (p3 >= 760 && p3 <= 769) return "Switzerland";
  if (p3 >= 770 && p3 <= 771) return "Colombia";
  if (p3 === 773) return "Uruguay";
  if (p3 === 775) return "Peru";
  if (p3 === 777) return "Bolivia";
  if (p3 >= 778 && p3 <= 779) return "Argentina";
  if (p3 === 780) return "Chile";
  if (p3 === 784) return "Paraguay";
  if (p3 === 786) return "Ecuador";
  if (p3 >= 789 && p3 <= 790) return "Brazil";
  if (p3 >= 750 && p3 <= 759) return "Mexico";
  if (p3 >= 800 && p3 <= 839) return "Italy";
  if (p3 >= 840 && p3 <= 849) return "Spain";
  if (p3 >= 868 && p3 <= 869) return "Turkey";
  if (p3 >= 850 && p3 <= 850) return "Cuba";
  if (p3 === 858) return "Slovakia";
  if (p3 === 859) return "Czechia";
  if (p3 === 860) return "Serbia";
  if (p3 === 865) return "Mongolia";
  if (p3 === 867) return "North Korea";
  if (p3 >= 870 && p3 <= 879) return "Netherlands";
  if (p3 === 880) return "South Korea";
  if (p3 === 884) return "Cambodia";
  if (p3 === 885) return "Thailand";
  if (p3 === 888) return "Singapore";
  if (p3 === 890) return "India";
  if (p3 === 893) return "Vietnam";
  if (p3 === 896) return "Pakistan";
  if (p3 === 899) return "Indonesia";
  if (p3 >= 900 && p3 <= 919) return "Austria";
  if (p3 >= 930 && p3 <= 939) return "Australia";
  if (p3 >= 940 && p3 <= 949) return "New Zealand";
  if (p3 === 955) return "Malaysia";
  if (p3 === 958) return "Macau";
  if (p3 >= 977 && p3 <= 977) return "a periodical (ISSN)";
  if (p3 >= 978 && p3 <= 979) return "a book (ISBN)";
  return "";
}

/**
 * Read a barcode and say everything that can be known about it.
 *
 * Returns
 *   raw          what was typed
 *   code         digits only
 *   ok           safe to save
 *   level        "ok" | "warn" | "error"
 *   format       "EAN-13", "UPC-A", … or "" when unrecognised
 *   message      one line, for a human, saying what to do about it
 *   suggestion   the corrected code when the fix is unambiguous
 *   internal     true for a code from a range reserved for in-shop use
 */
export function inspectBarcode(raw) {
  const input = String(raw ?? "").trim();
  const code = input.replace(/[^0-9]/g, "");

  if (!code) {
    return { raw: input, code: "", ok: true, level: "ok", format: "",
             message: "No barcode. The product can still be saved and scanned by name.",
             suggestion: "", internal: false };
  }

  if (/[^0-9\s-]/.test(input)) {
    return { raw: input, code, ok: false, level: "error", format: "",
             message: "A barcode is digits only. Remove the letters and other characters.",
             suggestion: code, internal: false };
  }

  // A code beginning 02, or 20–29, is from a range GS1 reserves for a shop's
  // OWN use — the number a supermarket prints on a tray of meat it weighed
  // itself. It has no check digit obligation and no meaning outside this shop,
  // so it must not be checked as though it were a manufacturer's number.
  const internal = /^(02|2[0-9])/.test(code);

  const format = BY_LENGTH[code.length] || "";

  if (internal) {
    return { raw: input, code, ok: true, level: "warn",
             format: format || `${code.length} digits`,
             message: "This is in the range reserved for a shop's own labels. "
                    + "Fine if you printed it yourself; if it came off a carton, re-read it.",
             suggestion: "", internal: true };
  }

  if (!format) {
    // Not a standard length. Saveable — plenty of real things carry
    // non-standard codes — but say so, because the usual cause is a digit
    // missing or one too many.
    const nearest = [8, 12, 13, 14]
      .map(n => ({ n, d: Math.abs(n - code.length) }))
      .sort((a, b) => a.d - b.d)[0];
    return { raw: input, code, ok: true, level: "warn", format: `${code.length} digits`,
             message: `${code.length} digits is not a standard barcode length. `
                    + `${nearest.n} would be ${BY_LENGTH[nearest.n]} — check for a `
                    + `missing or extra digit.`,
             suggestion: "", internal: false };
  }

  const body = code.slice(0, -1);
  const given = Number(code.slice(-1));
  const expected = gs1CheckDigit(body);

  if (given === expected) {
    const issuer = issuerHint(code);
    return { raw: input, code, ok: true, level: "ok", format,
             message: `Valid ${format}${issuer ? ` · issued by ${issuer}` : ""}.`,
             suggestion: "", internal: false };
  }

  // Wrong check digit. The two overwhelmingly common causes are one mistyped
  // digit and two adjacent digits swapped, so try to name the fix rather than
  // just refusing — being told WHICH digit is wrong is the difference between
  // correcting it and re-reading the whole number.
  const fixes = [];

  for (let i = 0; i < body.length; i++) {
    for (let d = 0; d <= 9; d++) {
      if (Number(body[i]) === d) continue;
      const candidate = body.slice(0, i) + d + body.slice(i + 1);
      if (gs1CheckDigit(candidate) === given) {
        fixes.push({ kind: "digit", at: i, code: candidate + given });
      }
    }
  }
  for (let i = 0; i < body.length - 1; i++) {
    if (body[i] === body[i + 1]) continue;
    const swapped = body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2);
    if (gs1CheckDigit(swapped) === given) {
      fixes.push({ kind: "swap", at: i, code: swapped + given });
    }
  }

  const corrected = body + expected;
  let message = `That is not a valid ${format}: the last digit should be `
              + `${expected}, not ${given}. Re-read the number off the carton.`;

  // Only offer a single unambiguous alternative. Several candidates means
  // guessing, and a confidently wrong barcode is worse than a refused one.
  const swap = fixes.filter(f => f.kind === "swap");
  if (swap.length === 1 && fixes.length === 1) {
    message = `That is not a valid ${format}. Two digits look transposed — `
            + `${swap[0].code} would be valid. Check the carton.`;
  }

  return { raw: input, code, ok: false, level: "error", format,
           message, suggestion: corrected, internal: false };
}

/** Pretty-print for display: 5 449000 000996 for an EAN-13. */
export function groupBarcode(code) {
  const c = String(code || "").replace(/[^0-9]/g, "");
  if (c.length === 13) return `${c[0]} ${c.slice(1, 7)} ${c.slice(7, 13)}`;
  if (c.length === 12) return `${c.slice(0, 1)} ${c.slice(1, 6)} ${c.slice(6, 11)} ${c.slice(11)}`;
  if (c.length === 8)  return `${c.slice(0, 4)} ${c.slice(4)}`;
  return c;
}
