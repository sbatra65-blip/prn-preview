# LabelDesk Step-by-Step Guides

**Website:** https://labeldesk.app
**Guide version:** 1.5 · **Last updated:** 26 November 2026
See also: **LabelDesk-Manual.md** for every feature in detail.

> To keep these guides current: when a screen or button changes, update the step that mentions it and add a line to the change log at the end.

---

## Contents

- [Before you start (all guides)](#before-you-start-all-guides)
- [Guide 1: New label by placing objects](#guide-1-new-label-by-placing-objects)
- [Guide 2: New label from a picture (AI)](#guide-2-new-label-from-a-picture-ai)
- [Guide 3: New label from a PRN file or printer code](#guide-3-new-label-from-a-prn-file-or-printer-code)
- [Guide 4: Picture to PRN (logo or label photo)](#guide-4-picture-to-prn-logo-or-label-photo)
- [Guide 5: Describe it, get a design](#guide-5-describe-it-get-a-design)
- [Guide 6: Labels from Excel (one label per row)](#guide-6-labels-from-excel-one-label-per-row)
- [Guide 7: Labels typed in at print time](#guide-7-labels-typed-in-at-print-time)
- [Guide 8: Hospital wristband](#guide-8-hospital-wristband)
- [Guide 9: Print and save](#guide-9-print-and-save)
- [Change log](#change-log)

---

## Before you start (all guides)

1. Open **https://labeldesk.app**.
2. Know your **printer model**, its **language** (TSC = TSPL, Zebra = ZPL) and **dpi** (on the printer's sticker or self-test print), and your **label size** in mm (width × height, gap between labels).
3. To print straight to a thermal printer from a computer, install **QZ Tray** once and start it.

---

## Guide 1: New label by placing objects

**Example:** 100 × 50 mm product label with name, MRP, batch, expiry date and EAN-13 barcode.

1. **Start a new design.** On the welcome screen click **Design a new label**, or **File → New design**. The **Label setup** form opens.
2. **Set up the label.**
   1. **Printer:** pick your model, e.g. TSC TE244. Language and dpi fill in; change them if your printer differs.
   2. **Stock size:** pick 100 × 50 mm, or type **Width 100** and **Height 50**.
   3. **Gap:** usually 2–3 mm. **Labels across:** 1.
   4. Click **Close setup**.
3. **Add the product name.**
   1. **Insert → Text ▾ → Text** (or the **Text** button at the start of the Edit tab). A text object appears.
   2. Double-click it and type `BASMATI RICE 1 KG`.
   3. In **Edit**, set the size (e.g. 16 pt). Pick a font, or keep the printer font for the sharpest print.
   4. Drag it to the top left.
4. **Add the MRP.**
   1. **Insert → Text ▾ → Text**, then type `MRP: ₹145.00 (incl. of all taxes)`.
   2. To line up "MRP:" and the value separately, use two text objects and **Align ▾ → Left** on each column.
5. **Add the batch number.** **Insert → Text**, then type `Batch: B2411`.
6. **Add the expiry date.**
   1. **Insert → Date & time ▾ → Expiry date (EXP, today + 6 months).**
   2. In the properties panel set **Add or subtract** (e.g. 12 months) and **Format** (e.g. MMM YYYY).
   3. **Takes the date and time:** keep **When printing starts**.
7. **Add the barcode.**
   1. **Insert → Barcodes ▾ → 1D ▸ EAN-13** (the same **Barcodes ▾** button is also on the Edit tab).
   2. In properties, type the 12 or 13 digits; the check digit is worked out.
   3. Drag the corner handle to size it. Keep the white space at both sides (quiet zone).
8. **Tidy up.**
   1. Select several objects (Shift+click), then **Align ▾ → Left**.
   2. **Insert → Line or box ▾ → Line** for a divider.
   3. Turn on **Grid** and **Snap 0.5 mm** for neat placement.
9. **Check.** Click **1:1** to see real size (calibrate first: File → Settings → Calibrate screen), and **Tools → Check ▾ → LMPC check** for packaged goods.
10. **Print and save:** see [Guide 9](#guide-9-print-and-save).

---

## Guide 2: New label from a picture (AI)

**Use it when:** you have an existing printed label and want an editable copy.

1. **Take a good photo.** Straight on, flat, in good light, with the whole label in the frame and no glare on barcodes.
2. **Open the picture tool.** **Insert → Picture ▾ → Picture to label (AI)…** (or the welcome card **Turn a picture into PRN**).
3. **Add the photo.** Upload it, or take it with the phone camera.
4. **Let AI read it.** LabelDesk reads the text, finds barcodes and QR codes, and reads their data from the picture.
5. **Check the result.** The design opens as normal objects (text, barcodes, lines). Compare it with the photo:
   - Fix any misread text by double-clicking it.
   - Check barcode data in properties.
   - Lines such as "Batch: B2411" come in as separate label and value objects.
6. **Set the printer and size.** **File → Label setup…** → choose your printer and the real label size. Objects keep their positions.
7. **Make it reusable.** Turn changing values into fields: select an object → **Content comes from → field / date / serial / asked when printing**.
8. **Print and save:** see [Guide 9](#guide-9-print-and-save).

Tip: very small text or a crumpled label reads less well. Take the photo again closer, or type those lines in.

---

## Guide 3: New label from a PRN file or printer code

**Use it when:** you have a .prn file from BarTender, an ERP or a supplier, or code like TSPL or ZPL.

### A. Open a PRN file

1. **Tools → Printer files ▾ → Open .prn…** (or the welcome card **Open a PRN file**).
2. Choose the file. LabelDesk detects the language (TSPL, ZPL, EPL2, DPL, SBPL, Fingerprint, CPCL).
3. **Preview** shows the label exactly as it will print, with size and dpi.
4. To print it unchanged, press **Print**.

### B. Paste printer code

1. **Tools → Printer files ▾ → Paste printer code…** (or **File → Open → Printer code (paste)…**).
2. Paste the code, for example text copied from an email or ERP.
3. The preview appears.

### C. Turn it into an editable design

1. In the preview, click **Edit in designer** (or **Bring into designer**).
2. The code becomes objects: text, barcodes, lines, boxes and graphics.
3. Check fonts and positions, then edit as in Guide 1.
4. To change the printer language (e.g. a ZPL file for a TSC printer): **File → Label setup** → change printer and language, then **File → Save → Download .prn** for new code.

---

## Guide 4: Picture to PRN (logo or label photo)

1. **Insert → Picture ▾ → Picture to PRN…**
2. Choose the **printer language** and **dpi**.
3. Upload the picture.
   - **Logo:** becomes a black-and-white printer graphic.
   - **Label photo:** AI builds printer code for the whole label.
4. Preview the result, then **Download .prn**, print it, or bring it into the designer.

---

## Guide 5: Describe it, get a design

1. Click the describe bar (on phones, tap **✨**).
2. Type or speak (English or Hindi), for example:
   `100×50 mm label for 1 kg rice with product name, MRP, batch, expiry and EAN-13`
3. Click **Design it**. A design appears in a few seconds.
4. To change it, tick **change current** and type, for example `make the MRP bigger and move the barcode to the right`.
5. Fine-tune by hand as in Guide 1.

---

## Guide 6: Labels from Excel (one label per row)

1. **Prepare the sheet.** The first row holds column names (e.g. Product, MRP, Batch, EAN); one row per label.
2. **Data → Connect ▾ → CSV / Excel / JSON / XML file…** and choose the file.
3. **Link objects to columns.** Select an object → **Content comes from → field** → pick the column. The label shows the first row as a sample.
4. **Combine values if needed.** **Content comes from → Built from parts**, e.g. `MRP: ₹` + MRP field.
5. **Pick rows.** **Data → Records**, then tick rows or type `1,3,5-9,14-25(3)`, where `(3)` means 3 copies of each. Filters and "Ask in words" search are available.
6. **Preview** the selected labels page by page, then **Print**.

---

## Guide 7: Labels typed in at print time

**Use it when:** each label needs a value typed in, such as a weight, a batch or a name.

1. Select the object → **Content comes from → Asked when printing**.
2. Set the question (e.g. "Net weight"), type (text, number, date, list or scan), required, and **keep last value**.
3. Click **Print** (Edit tab). The form appears in the print window.
4. Fill it in and press **Print and next**. It prints and clears for the next label.

---

## Guide 8: Hospital wristband

1. **File → New wristband ▸ Hospital: adult** (or child or infant).
2. The band opens with name, MRN, DOB, sex, ward, admission date and barcodes. The printer is set to a wristband printer if yours is too narrow.
3. Load wristbands in the printer and do one **test print**. If text falls on the clasp, drag it along the band.
4. Click **Print** (Edit tab), fill in the patient details (scan the MRN if you have a scanner), then **Print and next** for the next patient.
5. Patient details are not saved in the design.

---

## Guide 9: Print and save

### Print

1. Click **Print** at the start of the **Edit** tab, or **File → Print label…** (Ctrl+P).
2. Choose the **printer** and **mode**:
   - **Printer commands** for thermal label printers (QZ Tray must be running).
   - **Image via driver** for any printer or colour.
   - **PDF to the printer** for PDF-capable printers and Mac.
3. Set copies, records, and the form fields if any.
   **After printing:** choose **Tear off**, **Peel off each label**, **Cut after every label**, **Cut after every … labels** (type the number) or **Cut once at the end of the job**. Peel and cut need the peeler or cutter fitted on the printer.
4. Press **Print 1 test label** first. Check alignment, then print the full job.

### Save

- **Quick:** the design is kept automatically in this browser and appears in **Recent designs**.
- **Permanent:** **File → Save → Save as .ldl file…** keeps the file on your device. Open it anywhere with **File → Open → LabelDesk file (.ldl)**.
- **All devices:** **File → Save → Save to cloud** (after sign-in).
- **For other software:** **File → Save → Download .prn**.

---

## Change log

| Version | Date | Changes |
|---|---|---|
| 1.5 | 26 Nov 2026 | Text, Barcodes, Image and Database buttons are also on the Edit tab, before Print |
| 1.4 | 26 Nov 2026 | No step changes; button tips no longer pop up on phones (see manual 1.4) |
| 1.3 | 26 Nov 2026 | Print is on the Edit tab ribbon |
| 1.2 | 26 Nov 2026 | Printing starts from the printer icon or File → Print label… |
| 1.1 | 26 Nov 2026 | Guide 9: peel-off and cutter choices |
| 1.0 | 26 Nov 2026 | First guides: placing objects, picture to label (AI), PRN files and code, picture to PRN, describe it, Excel, typed at print time, wristband, print and save |
| | | *Add new rows above this line* |
