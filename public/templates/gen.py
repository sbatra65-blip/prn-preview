"""
LMPC (Legal Metrology - Packaged Commodities Rules, 2011, as amended to 2026)
label template generator.

One layout per template (in millimetres) -> TSPL (TSC), ZPL (Zebra / Honeywell /
Printronix / TSC in ZPL emulation), EPL2 (older Zebra/Eltron, TSC EPL emulation)
at 203 and 300 dpi, plus a PNG preview and a JSON template spec.

Sample data only. Test-print every file before production use.
"""
import json, os, math
from PIL import Image, ImageDraw, ImageFont
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.graphics import renderPM

OUT = os.path.join(os.path.dirname(__file__), "out")
FONT = "/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf"
CAP = 0.72          # numeral (cap) height as a fraction of font em size
PITCH = 1.28        # line pitch as multiple of em
MARGIN = 2.0        # mm

# ---------- GS1 helpers ----------
def gs1_check(digits: str) -> str:
    s = 0
    for i, d in enumerate(reversed(digits)):
        s += int(d) * (3 if i % 2 == 0 else 1)
    return str((10 - s % 10) % 10)

EAN12 = "890123456789"                      # 890 = GS1 India prefix (sample company/item no.)
EAN13 = EAN12 + gs1_check(EAN12)
GTIN14 = "0" + EAN13
CARTON12 = "1" + EAN12                      # indicator digit 1 for the outer case
CARTON_GTIN = CARTON12 + gs1_check(CARTON12)

# ---------- layout builder ----------
class Layout:
    def __init__(self, code, title, w, h, pdp_note, min_h):
        self.code, self.title, self.w, self.h = code, title, w, h
        self.pdp_note, self.min_h = pdp_note, min_h
        self.el = []
        self.y = MARGIN

    def text(self, s, hmm, x=MARGIN, field=None, advance=True):
        em = hmm / CAP
        self.el.append(dict(t="text", x=x, y=self.y, h=hmm, em=em, s=s, field=field))
        if advance:
            self.y += em * PITCH
        return self

    def rule(self, gap=0.8, thick=0.3):
        self.y += gap * 0.5
        self.el.append(dict(t="rule", x=MARGIN, y=self.y, w=self.w - 2 * MARGIN, th=thick))
        self.y += thick + gap * 0.5
        return self

    def gap(self, mm):
        self.y += mm
        return self

    def ean13(self, x, y, module, height):
        self.el.append(dict(t="ean13", x=x, y=y, mod=module, bh=height, data=EAN12))
        return self

    def dm(self, x, y, module, data_hri):
        # data_hri e.g. [("01",GTIN14),("17","271110"),("10","B2611A")]
        self.el.append(dict(t="dm", x=x, y=y, mod=module, ais=data_hri))
        return self

    def gs1_128(self, x, y, module, height, ais):
        self.el.append(dict(t="gs1128", x=x, y=y, mod=module, bh=height, ais=ais))
        return self


def ai_plain(ais):            # 0108901234567892172711101B2611A
    return "".join(a + v for a, v in ais)

def ai_hri(ais):              # (01)08901234567892(17)271110(10)B2611A
    return "".join(f"({a}){v}" for a, v in ais)

# ---------- templates ----------
def templates():
    T = []

    # LM-01: compact retail label, small pack (PDP <= 100 cm2 -> min 1.5 mm)
    L = Layout("LM-01", "Compact retail label 50 x 38 mm (small packs, PDP up to 100 cm2)",
               50, 38, "Panel area up to 100 cm2: min 1.5 mm numerals and letters", 1.5)
    L.text("BASMATI RICE PREMIUM", 2.2, field="common_name")
    L.text("Net Quantity: 100 g", 2.0, field="net_quantity")
    L.text("MRP Rs. 25.00 (incl. of all taxes)", 2.0, field="mrp")
    L.text("Unit Sale Price: Rs. 0.25 per g", 1.5, field="unit_sale_price")
    L.text("Mfg: 11/2026   Best Before: 10/05/2027", 1.5, field="dates")
    L.text("Batch: B2611A", 1.5, field="batch")
    L.text("Mfd & Pkd by: Sample Foods Pvt Ltd,", 1.5, field="manufacturer")
    L.text("Plot 12, Okhla Ph-II, New Delhi-110020", 1.5, field="manufacturer_address")
    L.text("Consumer Care: Manager, at above address", 1.5, field="consumer_care")
    L.text("Ph: 011-40000000  care@samplefoods.in", 1.5, field="consumer_care_contact")
    T.append(L)

    # LM-02: standard retail label with EAN-13 (PDP <= 100 cm2 -> 1.5 mm; key numerals 2.5)
    L = Layout("LM-02", "Standard retail label 75 x 50 mm with EAN-13 (PDP up to 100 cm2)",
               75, 50, "Panel area up to 100 cm2: min 1.5 mm numerals and letters", 1.5)
    L.text("BASMATI RICE PREMIUM", 3.0, field="common_name")
    L.text("Net Quantity: 500 g", 2.5, field="net_quantity")
    L.text("MRP Rs. 99.00 (incl. of all taxes)", 2.5, field="mrp")
    L.text("Unit Sale Price: Rs. 198.00 per kg", 1.8, field="unit_sale_price")
    L.text("Mfg: 11/2026    Best Before: 10/05/2027    Batch: B2611A", 1.8, field="dates_batch")
    L.rule()
    y0 = L.y
    L.text("Mfd & Pkd by:", 1.6, field="manufacturer")
    L.text("Sample Foods Pvt Ltd, Plot 12,", 1.6, field="manufacturer")
    L.text("Okhla Ph-II, New Delhi-110020", 1.6, field="manufacturer_address")
    L.text("Consumer Care: Manager,", 1.6, field="consumer_care")
    L.text("at above address", 1.6, field="consumer_care")
    L.text("Ph: 011-40000000", 1.6, field="consumer_care_contact")
    L.text("care@samplefoods.in", 1.6, field="consumer_care_contact")
    L.ean13(x=37.0, y=y0 + 0.5, module=0.375, height=15.0)
    T.append(L)

    # LM-03: retail label 100 x 75 with EAN-13 + GS1 DataMatrix (Sunrise 2027 dual marking)
    L = Layout("LM-03", "Retail label 100 x 75 mm, EAN-13 + GS1 DataMatrix (PDP 100-500 cm2)",
               100, 75, "Panel area 100-500 cm2: min 2.5 mm numerals and letters", 2.5)
    L.text("BASMATI RICE PREMIUM", 3.6, field="common_name")
    L.text("Net Quantity: 1 kg", 3.0, field="net_quantity")
    L.text("MRP Rs. 185.00 (incl. of all taxes)", 3.0, field="mrp")
    L.text("Mfg: 11/2026   Best Before: 10/05/2027", 2.5, field="dates")
    L.text("Batch: B2611A", 2.5, field="batch")
    L.rule()
    L.text("Mfd & Pkd by: Sample Foods Pvt Ltd, Plot 12,", 2.5, field="manufacturer")
    L.text("Okhla Phase-II, New Delhi-110020", 2.5, field="manufacturer_address")
    L.text("Consumer Care: Manager, at above address,", 2.5, field="consumer_care")
    L.text("Ph: 011-40000000, care@samplefoods.in", 2.5, field="consumer_care_contact")
    by = L.y + 1.0
    L.ean13(x=MARGIN, y=by, module=0.375, height=12.0)
    L.dm(x=60.0, y=by, module=0.5,
         data_hri=[("01", GTIN14), ("17", "270510"), ("10", "B2611A")])
    L.text("(01)" + GTIN14 + " (17)270510 (10)B2611A", 1.6, x=48.0, field="gs1_hri",
           advance=False)
    # place HRI under the DataMatrix
    L.el[-1]["y"] = by + 13.5
    L.el[-1]["x"] = 48.0
    T.append(L)

    # LM-04: imported electronics 100 x 150 (PDP 500-2500 cm2 -> 4 mm)
    L = Layout("LM-04", "Imported product label 100 x 150 mm (PDP 500-2500 cm2)",
               100, 150, "Panel area 500-2500 cm2: min 4.0 mm numerals and letters", 4.0)
    L.text("BLUETOOTH SPEAKER", 5.0, field="common_name")
    L.text("Model: X5", 4.0, field="model")
    L.text("Net Quantity: 1 Unit", 4.5, field="net_quantity")
    L.text("MRP Rs. 2,499.00", 5.0, field="mrp")
    L.text("(incl. of all taxes)", 4.0, field="mrp")
    L.text("Month & Year of Mfg: 09/2026", 4.0, field="mfg_date")
    L.text("Dimensions: 18 x 7 x 7 cm", 4.0, field="dimensions")
    L.text("Country of Origin: China", 4.0, field="country_of_origin")
    L.rule()
    L.text("Imported & Marketed by:", 4.0, field="importer")
    L.text("Sample Electronics Pvt Ltd,", 4.0, field="importer")
    L.text("B-45, Sector 63, Noida,", 4.0, field="importer_address")
    L.text("UP-201301", 4.0, field="importer_address")
    L.text("Consumer Care: Manager,", 4.0, field="consumer_care")
    L.text("at above address", 4.0, field="consumer_care")
    L.text("Ph: 0120-4000000", 4.0, field="consumer_care_contact")
    L.text("care@sampleelec.in", 4.0, field="consumer_care_contact")
    L.ean13(x=MARGIN, y=L.y + 1.0, module=0.375, height=10.0)
    T.append(L)

    # LM-05: wholesale carton (Rule 24) 100 x 150 with GS1-128
    L = Layout("LM-05", "Wholesale carton label 100 x 150 mm (Rule 24) with GS1-128",
               100, 150, "Wholesale package: Rule 24 declarations (no Table I size rule; 4 mm used)", 4.0)
    L.text("WHOLESALE PACKAGE", 5.0, field="header")
    L.rule()
    L.text("Commodity:", 4.0, field="identity")
    L.text("Basmati Rice Premium 500 g", 4.5, field="identity")
    L.text("Contains: 24 retail packs", 5.0, field="retail_pack_count")
    L.text("Batch: B2611A   Mfg: 11/2026", 4.0, field="batch")
    L.rule()
    L.text("Mfd & Pkd by:", 4.0, field="manufacturer")
    L.text("Sample Foods Pvt Ltd,", 4.0, field="manufacturer")
    L.text("Plot 12, Okhla Phase-II,", 4.0, field="manufacturer_address")
    L.text("New Delhi-110020", 4.0, field="manufacturer_address")
    L.rule()
    L.text("Carton No: 0001 / 0120", 4.0, field="carton_no")
    L.gs1_128(x=MARGIN, y=L.y + 2.0, module=0.375, height=25.0,
              ais=[("01", CARTON_GTIN), ("30", "24")])
    T.append(L)
    return T

# ---------- emitters ----------
def dots(mm, dpi):
    return int(round(mm * dpi / 25.4))

def tspl(L, dpi):
    o = [f"SIZE {L.w} mm, {L.h} mm", "GAP 3 mm, 0 mm", "DIRECTION 1,0",
         "REFERENCE 0,0", "CODEPAGE 1252", "DENSITY 8", "SPEED 4", "CLS"]
    for e in L.el:
        if e["t"] == "text":
            pt = round(e["em"] / 0.3528, 1)      # font "0" scalable: size in points
            s = e["s"].replace('"', '\\["]')
            o.append(f'TEXT {dots(e["x"],dpi)},{dots(e["y"],dpi)},"0",0,{pt},{pt},"{s}"')
        elif e["t"] == "rule":
            o.append(f'BAR {dots(e["x"],dpi)},{dots(e["y"],dpi)},{dots(e["w"],dpi)},{max(2,dots(e["th"],dpi))}')
        elif e["t"] == "ean13":
            n = max(2, dots(e["mod"], dpi))
            o.append(f'BARCODE {dots(e["x"],dpi)},{dots(e["y"],dpi)},"EAN13",{dots(e["bh"],dpi)},1,0,{n},{n},"{e["data"]}"')
        elif e["t"] == "dm":
            m = max(3, dots(e["mod"], dpi))
            sz = m * 24
            data = "~1" + ai_plain(e["ais"])            # c126 -> '~' escape, ~1 = FNC1
            o.append(f'DMATRIX {dots(e["x"],dpi)},{dots(e["y"],dpi)},{sz},{sz},c126,x{m},"{data}"')
        elif e["t"] == "gs1128":
            n = max(2, dots(e["mod"], dpi))
            o.append(f'BARCODE {dots(e["x"],dpi)},{dots(e["y"],dpi)},"EAN128",{dots(e["bh"],dpi)},2,0,{n},{n},"{ai_plain(e["ais"])}"')
    o.append("PRINT 1,1")
    return "\r\n".join(o) + "\r\n"

def zpl(L, dpi):
    o = ["^XA", "^CI28", f"^PW{dots(L.w,dpi)}", f"^LL{dots(L.h,dpi)}", "^LH0,0"]
    for e in L.el:
        x, y = dots(e["x"], dpi), dots(e["y"], dpi)
        if e["t"] == "text":
            hd = dots(e["em"], dpi)
            o.append(f'^FO{x},{y}^A0N,{hd},{int(hd*0.85)}^FD{e["s"]}^FS')
        elif e["t"] == "rule":
            th = max(2, dots(e["th"], dpi))
            o.append(f'^FO{x},{y}^GB{dots(e["w"],dpi)},{th},{th}^FS')
        elif e["t"] == "ean13":
            n = max(2, dots(e["mod"], dpi))
            o.append(f'^BY{n}^FO{x},{y}^BEN,{dots(e["bh"],dpi)},Y,N^FD{e["data"]}^FS')
        elif e["t"] == "dm":
            m = max(3, dots(e["mod"], dpi))
            o.append(f'^FO{x},{y}^BXN,{m},200,0,0,6,_^FD_1{ai_plain(e["ais"])}^FS')
        elif e["t"] == "gs1128":
            n = max(2, dots(e["mod"], dpi))
            o.append(f'^BY{n}^FO{x},{y}^BCN,{dots(e["bh"],dpi)},Y,N,N,D^FD{ai_hri(e["ais"])}^FS')
    o += ["^PQ1", "^XZ"]
    return "\n".join(o) + "\n"

EPL_FONTS = {1: (8, 12), 2: (10, 16), 3: (12, 20), 4: (14, 24), 5: (32, 48)}  # 203 dpi cells

def epl_font(hmm):
    """Narrowest EPL font/multiplier whose cap height meets hmm and whose
    character width is at least 1/3 of its height (LMPC Rule 7(3))."""
    need = hmm * 203 / 25.4 / CAP
    best = None
    for f, (cw, ch) in EPL_FONTS.items():
        for v in range(1, 7):
            if ch * v < need:
                continue
            for h in range(1, v + 1):
                if cw * h / (ch * v) < 0.33:
                    continue
                cand = (cw * h, ch * v, f, h, v)
                if best is None or cand < best:
                    best = cand
                break
    _, _, f, h, v = best
    return f, h, v

def epl(L):
    dpi = 203
    o = ["", "N", f"q{dots(L.w,dpi)}", f"Q{dots(L.h,dpi)},24", "R0,0", "S3", "D8", "ZT"]
    warn = []
    for e in L.el:
        x, y = dots(e["x"], dpi), dots(e["y"], dpi)
        if e["t"] == "text" and e.get("field") == "gs1_hri":
            continue
        if e["t"] == "text":
            f, hm, vm = epl_font(e["h"])
            width = len(e["s"]) * EPL_FONTS[f][0] * hm
            if x + width > dots(L.w, dpi):
                warn.append(f'{L.code} EPL text overflows ({width}d): "{e["s"]}"')
            s = e["s"].replace('"', '\\"')
            o.append(f'A{x},{y},0,{f},{hm},{vm},N,"{s}"')
        elif e["t"] == "rule":
            o.append(f'LO{x},{y},{dots(e["w"],dpi)},{max(2,dots(e["th"],dpi))}')
        elif e["t"] == "ean13":
            n = max(2, dots(e["mod"], dpi))
            o.append(f'B{x},{y},0,E30,{n},{n},{dots(e["bh"],dpi)},B,"{e["data"]}"')
        elif e["t"] == "dm":
            o.append(f'; GS1 DataMatrix omitted: use the ZPL or TSPL file for 2D codes')
        elif e["t"] == "gs1128":
            n = max(2, dots(e["mod"], dpi))
            o.append(f'B{x},{y},0,1E,{n},{n},{dots(e["bh"],dpi)},B,"{ai_plain(e["ais"])}"')
    o.append("P1")
    return "\n".join(o) + "\n", warn

def pgl(L, dpi):
    """Printronix IGP/PGL (T-series / T4000 / T6000 / T8000 thermal).
    Rows/columns in dots via SCALE;DOT. GS1 DataMatrix omitted (use the ZPL
    file in Printronix ZGL emulation for 2D)."""
    name = L.code.replace("-", "")
    o = [f"~CREATE;{name};{dots(L.h, dpi)}", f"SCALE;DOT;{dpi};{dpi}"]
    texts = [e for e in L.el if e["t"] == "text" and e.get("field") != "gs1_hri"]
    if texts:
        o.append("ALPHA")
        for e in texts:
            pt = max(4, int(round(e["em"] / 0.3528)))
            o.append(f'POINT;{dots(e["y"],dpi)};{dots(e["x"],dpi)};{pt};0;*{e["s"]}*')
        o.append("STOP")
    rules = [e for e in L.el if e["t"] == "rule"]
    if rules:
        o.append("HORZ")
        for e in rules:
            x = dots(e["x"], dpi)
            o.append(f'{max(2,dots(e["th"],dpi))};{dots(e["y"],dpi)};{x};{x+dots(e["w"],dpi)}')
        o.append("STOP")
    for e in L.el:
        if e["t"] in ("ean13", "gs1128"):
            hin = e["bh"] / 25.4
            n = max(4, int(hin * 10))
            extra = max(0, dots(e["bh"], dpi) - int(n / 10 * dpi))
            hp = f"H{n}.{extra}" if extra else f"H{n}"
            kind = "EAN13" if e["t"] == "ean13" else "UCC-128"
            data = e["data"] if e["t"] == "ean13" else ai_plain(e["ais"])
            o += ["BARCODE", f'{kind};{hp};{dots(e["y"],dpi)};{dots(e["x"],dpi)}',
                  f"*{data}*", "PDF", "STOP"]
    o += ["END", f"~EXECUTE;{name};1", "~NORMAL"]
    return "\r\n".join(o) + "\r\n"

# ---------- preview ----------
PX = 12  # px per mm

def bc_img(kind, value, **kw):
    d = createBarcodeDrawing(kind, value=value, **kw)
    p = os.path.join(OUT, "_tmp.png")
    renderPM.drawToFile(d, p, fmt="PNG", dpi=300)
    im = Image.open(p).convert("L")
    # crop white border
    bbox = Image.eval(im, lambda v: 255 - v).getbbox()
    return im.crop(bbox) if bbox else im

def preview(L):
    W, H = int(L.w * PX), int(L.h * PX)
    im = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(im)
    warn = []
    for e in L.el:
        x, y = int(e["x"] * PX), int(e["y"] * PX)
        if e["t"] == "text":
            f = ImageFont.truetype(FONT, max(6, int(e["em"] * PX)))
            d.text((x, y), e["s"], font=f, fill=0)
            tw = d.textlength(e["s"], font=f)
            if x + tw > W - MARGIN * PX * 0.5:
                warn.append(f'{L.code} text near/over edge: "{e["s"]}" ({(x+tw)/PX:.1f} of {L.w} mm)')
            if e["y"] + e["em"] > L.h:
                warn.append(f'{L.code} text below label: "{e["s"]}"')
        elif e["t"] == "rule":
            d.rectangle([x, y, x + int(e["w"] * PX), y + max(2, int(e["th"] * PX))], fill=0)
        elif e["t"] == "ean13":
            b = bc_img("EAN13", e["data"], barHeight=e["bh"] * 2.835, barWidth=e["mod"] * 2.835)
            target_w = int((95 + 18) * e["mod"] * PX)
            b = b.resize((target_w, int(target_w * b.height / b.width)))
            im.paste(b, (x, y))
            if e["y"] + b.height / PX > L.h:
                warn.append(f"{L.code} EAN-13 runs off label")
        elif e["t"] == "dm":
            b = bc_img("ECC200DataMatrix", ai_plain(e["ais"]))
            s = int(24 * e["mod"] * PX)
            im.paste(b.resize((s, s), Image.NEAREST), (x, y))
        elif e["t"] == "gs1128":
            b = bc_img("Code128", ai_plain(e["ais"]), barHeight=e["bh"] * 2.835, barWidth=e["mod"] * 2.835)
            tw = min(int((L.w - 2 * MARGIN) * PX), b.width)
            b = b.resize((tw, int(e["bh"] * PX)))
            im.paste(b, (x, y))
            f = ImageFont.truetype(FONT, int(3.2 / CAP * PX))
            d.text((x, y + int(e["bh"] * PX) + 6), ai_hri(e["ais"]), font=f, fill=0)
    # outline
    d.rectangle([0, 0, W - 1, H - 1], outline=160)
    return im, warn

# ---------- spec JSON ----------
def spec(L):
    return {
        "template": L.code, "title": L.title, "size_mm": [L.w, L.h],
        "lmpc": {"rules": "Legal Metrology (Packaged Commodities) Rules, 2011, as amended to Feb 2026",
                 "panel_class": L.pdp_note, "min_height_mm": L.min_h},
        "elements": L.el,
    }

def main():
    os.makedirs(OUT, exist_ok=True)
    warns = []
    sheets = []
    for L in templates():
        base = os.path.join(OUT, L.code)
        os.makedirs(base, exist_ok=True)
        for dpi in (203, 300, 600):
            open(f"{base}/{L.code}_TSPL_{dpi}dpi.prn", "w", newline="").write(tspl(L, dpi))
            open(f"{base}/{L.code}_ZPL_{dpi}dpi.prn", "w").write(zpl(L, dpi))
            open(f"{base}/{L.code}_PGL-Printronix_{dpi}dpi.prn", "w", newline="").write(pgl(L, dpi))
        txt, w = epl(L); warns += w
        open(f"{base}/{L.code}_EPL2_203dpi.prn", "w").write(txt)
        json.dump(spec(L), open(f"{base}/{L.code}_template.json", "w"), indent=2)
        im, w = preview(L); warns += w
        im.save(f"{base}/{L.code}_preview.png")
        sheets.append((L, im))
    if os.path.exists(os.path.join(OUT, "_tmp.png")):
        os.remove(os.path.join(OUT, "_tmp.png"))
    # contact sheet
    pad = 40
    title_h = 60
    cols = [sheets[:3], sheets[3:]]
    colw = [max(im.width for _, im in c) for c in cols]
    colh = [sum(im.height + title_h + pad for _, im in c) for c in cols]
    S = Image.new("L", (sum(colw) + pad * 3, max(colh) + pad), 235)
    dd = ImageDraw.Draw(S)
    tf = ImageFont.truetype(FONT, 26)
    xo = pad
    for ci, c in enumerate(cols):
        yo = pad
        for L, im in c:
            dd.text((xo, yo), f"{L.code}  {L.title}", font=tf, fill=0)
            S.paste(im, (xo, yo + title_h - 14))
            yo += im.height + title_h + pad
        xo += colw[ci] + pad
    S.save(os.path.join(OUT, "LMPC_templates_preview.png"))
    print("\n".join(warns) if warns else "no layout warnings")

if __name__ == "__main__":
    main()
