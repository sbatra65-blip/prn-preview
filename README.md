# PRN Label Preview

Free web tool to preview thermal-printer label files (PRN) in the browser.

- Auto-detects the printer language: **TSPL** (TSC), **ZPL** (Zebra; Honeywell, Printronix, TSC in ZPL emulation), **EPL2** (Zebra / Eltron), **PGL** (Printronix).
- Choose printer resolution: 203, 300 or 600 dpi.
- Draws the label from the PRN code itself; edit the code and the preview updates live.
- Includes five label templates compliant with India's Legal Metrology (Packaged Commodities) Rules, 2011 (as amended to Feb 2026), with an LMPC checklist for each.

The whole site is one static file, `index.html`. No build step.

## Hosting

**Cloudflare Pages:** Workers & Pages → Create → Pages → Connect to Git → this repo. Framework preset: None. Build command: empty. Output directory: `/`.

**GitHub Pages:** Settings → Pages → Deploy from branch `main`, folder `/ (root)`.

## Templates

`templates/` holds the LMPC label files for each printer language and resolution, previews, JSON design specs and `gen.py`, which regenerates them all. Sample data only: test-print before production use.

Prices print as "Rs." because built-in printer fonts lack the ₹ sign.
