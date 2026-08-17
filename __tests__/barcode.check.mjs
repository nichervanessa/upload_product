// A mistyped barcode is the worst kind of bad data in a shop: the product saves
// cleanly, looks right everywhere, and never scans at the till. Nobody connects
// the two, and the fix is to find the carton again.
//
// So the check digit is verified before anything is sent, and this pins that
// arithmetic against real barcodes.
//
// Run with:  node webadd/__tests__/barcode.check.mjs

import { gs1CheckDigit, inspectBarcode, groupBarcode } from "../barcode.js";

let failures = 0;
function has(name, cond) {
  if (cond) console.log("  ok   " + name);
  else { console.error("  FAIL " + name); failures++; }
}

console.log("check digits, against real barcodes");

// Coca-Cola 330ml (Belgium), a Nestlé bar, and a US-issued UPC-A.
has("EAN-13 5449000000996", gs1CheckDigit("544900000099") === 6);
has("EAN-13 4006381333931", gs1CheckDigit("400638133393") === 1);
has("UPC-A  036000291452", gs1CheckDigit("03600029145") === 2);
has("EAN-8  96385074",     gs1CheckDigit("9638507") === 4);

// The weights alternate from the RIGHT. Anchoring them on the left works for
// even-length codes and silently fails for odd ones, which is the classic bug
// and the reason these two lengths are both here.
has("the weighting is anchored on the right, so EAN-8 and EAN-13 both hold",
    gs1CheckDigit("9638507") === 4 && gs1CheckDigit("544900000099") === 6);

console.log("\nvalid codes are accepted");

const good = inspectBarcode("5449000000996");
has("a valid EAN-13 is ok", good.ok === true && good.level === "ok");
has("and it is named", good.format === "EAN-13");
has("with the issuer as a hint", good.message.includes("issued by"));

has("dashes and spaces are tolerated",
    inspectBarcode("5-449000 000996").ok === true);

has("an empty barcode is allowed — plenty of things have none",
    inspectBarcode("").ok === true && inspectBarcode("").level === "ok");

console.log("\nmistyped codes are caught");

// 5449000000996 with the last digit wrong.
const bad = inspectBarcode("5449000000997");
has("a wrong check digit is refused", bad.ok === false && bad.level === "error");
has("and the message names the digit it should be", bad.message.includes("should be 6"));
has("and offers the corrected code", bad.suggestion === "5449000000996");

// Two digits transposed: 5449000000996 -> 5449000009096 is not it; build one.
const transposed = inspectBarcode("4006381333391");   // 93 -> 39 in the body
has("a transposition is refused", transposed.ok === false);

has("letters are refused outright",
    inspectBarcode("54490A0000996").level === "error");

console.log("\nthings that are odd but not wrong");

const internal = inspectBarcode("2012345678903");
has("a shop's own label range is flagged, not refused",
    internal.ok === true && internal.level === "warn" && internal.internal === true);
has("and it says where it is fine to use one", internal.message.includes("printed it yourself"));

const shortCode = inspectBarcode("12345");
has("a non-standard length is allowed with a warning",
    shortCode.ok === true && shortCode.level === "warn");
has("and it names the nearest real length",
    shortCode.message.includes("EAN-8") || shortCode.message.includes("8"));

// An internal code must NOT be check-digit tested: those ranges carry no
// obligation, so refusing them would reject labels the shop printed itself.
has("an internal code is never judged on its check digit",
    inspectBarcode("2000000000001").ok === true);

console.log("\nformatting");
has("EAN-13 groups for reading", groupBarcode("5449000000996") === "5 449000 000996");
has("EAN-8 groups too", groupBarcode("96385074") === "9638 5074");
has("anything else is left alone", groupBarcode("12345") === "12345");

console.log(failures === 0
  ? "\nOK — a mistyped barcode is caught before it is saved."
  : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
