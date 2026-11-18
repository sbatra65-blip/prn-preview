# PRN Label Preview

Free web tool to preview thermal-printer label files (PRN) in the browser.

- Auto-detects the printer language: **TSPL** (TSC), **ZPL** (Zebra; Honeywell, Printronix, TSC in ZPL emulation), **EPL2** (Zebra / Eltron), **PGL** (Printronix).
- Choose printer resolution: 203, 300 or 600 dpi.
- Draws the label from the PRN code itself; edit the code and the preview updates live.
- Includes five label templates compliant with India's Legal Metrology (Packaged Commodities) Rules, 2011 (as amended to Feb 2026), with an LMPC checklist for each.

The site is one static file, `public/index.html`, served as Worker static assets (`wrangler.jsonc`). No build step.

## Hosting

Live at **https://labels.infinitesolutions.co.in** (Cloudflare Worker `prn-preview`; every push to `main` redeploys).

**Cloudflare Workers:** Workers & Pages → Create → Import a repository → this repo. Build command: empty. Deploy command: `npx wrangler deploy`.


## Templates

`public/templates/` holds the LMPC label files for each printer language and resolution, previews, JSON design specs and `gen.py`, which regenerates them all. Sample data only: test-print before production use.

Prices print as "Rs." because built-in printer fonts lack the ₹ sign.

## Pic2Label (picture → PRN)

- **Bitmap:** logo or picture → ZPL `^GFA` (compressed ASCII), TSPL `BITMAP` or EPL2 `GW`. Runs in the browser; Download .prn writes the binary data.
- **AI photo → PRN:** `POST /api/pic2label` (src/index.js) sends the photo to Cloudflare Workers AI (`@cf/meta/llama-4-scout-17b-16e-instruct`) and returns a layout; the page turns it into TSPL, ZPL, EPL2 or PGL. Limited to 8 requests per minute per IP. Barcodes are decoded in the browser where `BarcodeDetector` exists.
- The preview also renders ZPL `^GF` (hex, compressed, Z64/B64), `~DG` + `^XG`, TSPL `BITMAP` and EPL2 `GW` graphics.
