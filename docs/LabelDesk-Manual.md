# LabelDesk User Manual

**Product:** LabelDesk, the online label designer and PRN previewer
**Website:** https://labeldesk.app
**Made by:** Infinite Solutions, New Delhi
**Manual version:** 1.8 · **Last updated:** 26 November 2026

> How to keep this manual current: add a line to the **Change log** at the end whenever a feature is added or changed, update the section it affects, and raise the version number (1.0 → 1.1 for additions, 2.0 for big changes).

---

## Contents

1. [What LabelDesk does](#1-what-labeldesk-does)
2. [Getting started](#2-getting-started)
3. [The screen](#3-the-screen)
4. [Label setup: printer, size and colours](#4-label-setup-printer-size-and-colours)
5. [Adding objects](#5-adding-objects)
6. [Editing objects](#6-editing-objects)
7. [Dates, times and serial numbers](#7-dates-times-and-serial-numbers)
8. [Data: Excel, databases and records](#8-data-excel-databases-and-records)
9. [Asked when printing (data entry form)](#9-asked-when-printing-data-entry-form)
10. [Pictures and AI](#10-pictures-and-ai)
11. [PRN files: preview, paste and convert](#11-prn-files-preview-paste-and-convert)
12. [Wristbands](#12-wristbands)
13. [Printing](#13-printing)
14. [Printing from a phone](#14-printing-from-a-phone)
15. [Saving and opening designs](#15-saving-and-opening-designs)
16. [Privacy, encryption and PIN](#16-privacy-encryption-and-pin)
17. [Phones and tablets: touch gestures](#17-phones-and-tablets-touch-gestures)
18. [Keyboard shortcuts](#18-keyboard-shortcuts)
19. [Settings](#19-settings)
20. [Accounts and companies](#20-accounts-and-companies)
21. [Troubleshooting](#21-troubleshooting)
22. [Glossary](#22-glossary)
23. [Change log](#23-change-log)

---

## 1. What LabelDesk does

LabelDesk designs and prints barcode labels from any web browser on Windows, Mac, Android or iPhone. Nothing needs to be installed except the free **LabelDesk Print Agent** (or QZ Tray) on computers that print directly to a label printer.

- Design labels to the millimetre with text, 60+ barcode types, QR codes, lines, shapes, images, dates and serial numbers.
- Print to thermal label printers in their own language (TSPL, ZPL, EPL2, DPL, SBPL, Fingerprint, CPCL), or as an image or PDF to any printer.
- Open, preview and edit existing PRN printer files.
- Turn a photo of a label into an editable design or into PRN code with AI.
- Fill labels from Excel, CSV, JSON, XML, Tally, Zoho, SAP and other ERPs, and pick which records to print.
- Print wristbands, LMPC, GS1, courier, pharma, jewellery, asset and bin labels.

---

## 2. Getting started

1. Open **https://labeldesk.app** in Chrome, Edge, Safari or Firefox.
2. The welcome screen offers:
   - **Continue my last design**: reopens the draft kept in this browser.
   - **Describe it, get a design**: type or speak what the label should show.
   - **Design a new label**: pick printer and size, then add objects.
   - **Open a PRN file**: preview any printer file.
   - **Paste printer code**: paste TSPL, ZPL, EPL or other code.
   - **Turn a picture into PRN**: a logo becomes printer graphics, a label photo becomes editable code.
   - **Start from the library**: ready-made LMPC, GS1, courier, pharma, jewellery, asset and bin labels.
   - **Recent designs**: the last 5 designs worked on in this browser.
3. To use it like an app, install it:
   - **iPhone/iPad:** Safari → Share → **Add to Home Screen**.
   - **Android:** Chrome menu → **Install app**.
   - **Windows/Mac:** Chrome or Edge address bar → **Install** icon.

   An installed app keeps its saved data more reliably, especially on iPhone.

4. **LabelDesk apps.** Native apps open the same LabelDesk, so website updates reach them at once:

   | App | Get it | Differences from the website |
   |---|---|---|
   | **Android** | Install the LabelDesk .apk (Google Play once published) | Save, Download and PDF open the share sheet: save to Files or Drive, send by WhatsApp, or print. Camera for Picture to label |
   | **iPhone / iPad** | TestFlight, then the App Store once published | Same as Android |
   | **Windows** | Download and run **LabelDesk.exe** (about 12 MB) from https://labeldesk.app/download/LabelDesk.exe | Its own window and Start-menu icon, remembers its size. **Print Agent built in**: prints straight to installed and network printers with no QZ Tray. Other websites open in your browser; files save to Downloads |

   Without internet the apps show "LabelDesk can't reach the internet" with **Try again**. Designs kept on the device are not affected.

---

## 3. The screen

| Area | What it holds |
|---|---|
| **Top bar** | Logo, **File** menu, ribbon tabs (Edit, Insert, Data, View, Tools) |
| **Ribbon** | Buttons for the chosen tab. Buttons with ▾ open a menu; ▸ in a menu opens a sub-menu |
| **Describe bar** | Type or speak a label description (English or Hindi), then **Design it**. Tick **change current** to edit the open design instead of starting a new one. On phones it is behind the ✨ button |
| **View controls** | Show (As designed / Portrait / Landscape), Grid, Snap, Zoom −, Fit, 1:1, + |
| **Canvas** | The label on its liner, with rulers in mm. The size tag in the corner opens **Label setup** |
| **Properties panel** | Settings of the selected object and the list of all objects (top first). On phones it is the bottom sheet **Objects and properties** |

### Ribbon tabs

| Tab | Buttons |
|---|---|
| **File** (menu) | New design · New wristband ▸ · Label setup… · Open ▸ (Recent, My designs, .ldl file, paste code) · Save ▸ (cloud, .ldl, .prn, PNG) · Print label… · Print more ▸ · Settings ▸ · About |
| **Edit** (opens first) | Quick insert: **Text** · **Barcodes ▾** · **Image** · **Database ▾** (CSV/Excel/JSON/XML, business software, records) · **Print** · Clipboard ▾ (paste, copy, duplicate, delete) · Undo · Redo · Font · Size (pt) · Bold · Italic · Curve ▾ · Don't print · Align ▾ · Order ▾ · Rotate ▾ |
| **Insert** | Text ▾ · Date & time ▾ · Barcodes ▾ · Image · Line or box ▾ · Shapes ▾ · Picture ▾ (Picture to label, Picture to PRN) · Background |
| **Data** | Connect ▾ (CSV/Excel/JSON/XML, Tally, Zoho Inventory, SAP/Oracle/ERP, ODBC/SQL) · data source info · Records · fields · Serial number |
| **View** | Show ▾ (As designed, Portrait, Landscape, Grid) · Zoom ▾ (in, out, fit, actual size, calibrate) |
| **Tools** | Designer · Preview · Printer files ▾ · Templates · Check ▾ (LMPC check, GS1 guide) · Talk to us |

Right-click (or long-press on a phone) on an object for its menu. Right-click or double-click empty canvas for the **Insert** menu.

Hover over a button to see its name and shortcut. With the keyboard, Tab to a button to see the same tip. Tips don't pop up on their own when a window opens, and phones and tablets don't show them.

---

## 4. Label setup: printer, size and colours

Open with **File → Label setup…** or click the size tag on the canvas.

**Printer**
- **Printer:** TSC, Zebra, Honeywell, Printronix, SATO, Citizen, Godex and others, including wristband printers.
- **Language:** the printer's command language, for example TSPL for TSC or ZPL for Zebra.
- **Resolution:** 203, 300 or 600 dpi.
- The note under the printer shows its print width and what it can do.

**Label and media**
- **Stock size:** common sizes that fit the printer, grouped by labels across, plus a **Wristbands** group.
- **Width and height** in mm, **liner** width, **labels across**, **gap** between labels, **edge** margin.
- **Turn label 90°** switches portrait and landscape.
- The note shows how many stock sizes fit the chosen printer.

**Colours**
- Label colour, print colour, and **Background…** (colour, gradient or picture).
- Backgrounds show on screen, in PDF and in image printing. Thermal printer commands print black only.

Out-of-range numbers are corrected automatically and a yellow note says what was used. The form updates the label as you type; close it with **Close setup**, ✕ or Esc.

---

## 5. Adding objects

Use **Insert** on the ribbon, the right-click Insert menu, or double-click empty canvas.

| Object | Notes |
|---|---|
| **Text** | One line. Printer font prints sharpest; 60+ screen fonts and your own uploaded fonts are available |
| **Paragraph** | Text that wraps inside a box |
| **Date & time** | See [section 7](#7-dates-times-and-serial-numbers) |
| **Barcodes** | 1D (Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF-14 and more), 2D (QR, DataMatrix, PDF417, Aztec), GS1-128 with AI builder, Contact QR (vCard) |
| **Image** | BMP, JPG or PNG; logos print as printer graphics |
| **Line or box** | Lines, boxes, and guide lines that are not printed |
| **Shapes** | Rounded box, oval, star, hexagon and more; text can sit inside a shape or follow its outline |
| **Picture** | Picture to label (AI) or Picture to PRN, see [section 10](#10-pictures-and-ai) |
| **Background** | Colour, gradient or picture behind the label |

Tip: when a PRN file or picture is brought in, "MRP: 120.00" is split into two objects (label and value) so they line up neatly.

---

## 6. Editing objects

- **Select:** click or tap. Shift+click to select several, Ctrl+A for all. Tab moves to the next object.
- **Move:** drag, or use arrow keys (Shift+arrow for bigger steps). **Snap** in View controls step size.
- **Resize:** drag the corner handles.
- **Edit text:** double-click (double-tap on phones).
- **Font and size:** Edit tab → Font and pt box, or right-click → Font.
- **Bold, Italic:** work with screen fonts. Printer fonts use their own weight.
- **Curve:** Straight, Arch up, Arch down.
- **Align:** Left, Centre, Right, Top, Middle, Bottom on the label, or space several objects evenly.
- **Order:** Bring to front, Forward, Backward, Send to back.
- **Rotate:** 90° right, 90° left, Straighten, or any angle in properties.
- **Don't print:** keeps the object on screen only, for notes and guides.
- **Delete:** Del key, Clipboard → Delete, or right-click → Delete. Ctrl+Z undoes it.

### Properties panel

Shows position (X, Y), size, rotation, font, alignment and **Content comes from**:

- **Typed text:** what you type.
- **A field:** a database column or an "asked when printing" field.
- **Serial number:** counts up or down on each label.
- **Date or time:** today, expiry, clock (section 7).
- **Built from parts:** combine text, fields, dates, serials and special characters, for example `Batch-` + batch field + `-` + date.

---

## 7. Dates, times and serial numbers

### Insert a date or time

**Insert → Date & time ▾**

- **Date ▸** 15 formats, for example DD/MM/YYYY, DD-MM-YY, DDMMYY, YYYYMMDD, MM/YY, MMM-YY, DD MMM YYYY.
- **Time ▸** 7 formats, for example 19:45, 19:45:25, 07:45 PM, 1945.
- **Date and time ▸** combined formats.
- **Manufacturing date (MFG)**, **Expiry date** (today + 6 months), **Best before** (today + 30 days), **Packed on**.
- **Custom format…**

### Date and time settings (properties panel)

| Setting | Choices |
|---|---|
| Type | Date · Time · Date and time |
| Format | Pick from the list or **Custom format…** |
| Add or subtract | Days, months, years (date); minutes, hours (time). Use a minus number to go back |
| Takes the date and time | **When printing starts** (same on all labels of the job) · **Each label, when LabelDesk sends it** · **Printer's own clock** (Zebra ZPL printers with a clock) · **Fixed: taken once and kept**, with **Take now** and a date-time picker |
| Text before / after | For example `EXP: ` |

### Custom format codes

| Code | Prints | Code | Prints |
|---|---|---|---|
| YYYY / YY | 2026 / 26 | HH / H | 19 / 19 (24-hour) |
| MMMM / MMM | November / NOV | hh / h | 07 / 7 (12-hour) |
| MM / M | 11 / 11 | mm / ss | minutes / seconds |
| DD / D | 05 / 5 | A / a | PM / pm |
| DDD | day of year 001–366 | WW | week 01–53 |
| dddd / ddd | Wednesday / WED | Q | quarter 1–4 |

Put words in **[square brackets]** so their letters print as typed: `[Batch] YYDDD` → Batch 26329.

The Zebra printer clock knows only YYYY, YY, MMM, MM, DD, HH, hh, mm, ss and A. For other codes, or for other printer languages, LabelDesk fills the value in as each label is sent.

### Serial numbers

**Data → Serial number** (or Content comes from → Serial number): start value, step, number of digits, count up or down, change every N labels, and text before or after.

---

## 8. Data: Excel, databases and records

### Connect

**Data → Connect ▾**
- **CSV / Excel / JSON / XML file…**
- **Business software:** Tally, Zoho Inventory, SAP / Oracle / other ERP…, ODBC / SQL.
- **Disconnect:** objects keep their field links and show sample values.

After connecting, link an object to a column with **Content comes from → field**.

### Pick records to print

**Data → Records** (or in the Print window) shows the rows.
- Tick rows, or type a selection: `1,3,5-9,14-25(3)`.
  - `5-9` = records 5 to 9.
  - `(3)` = 3 copies of each label in that range.
- **Filters:** column, condition and value. Several filters can be combined.
- **Ask in words:** type or speak, for example "MRP above 500 and name has rice, 2 copies each".
- **Preview selected labels** shows them page by page before printing.

---

## 9. Asked when printing (data entry form)

Use this for details typed in at print time, such as a patient name, a batch number or a weight.

1. Select the object → **Content comes from → Asked when printing**.
2. Set the **question**, **type** (text, number, date, list, scan), maximum length, **required**, and **keep last value**.
3. When you press **Print**, the form appears in the print window.
4. **Print and next** prints and clears the form for the next label. Values marked "keep" stay filled in.

---

## 10. Pictures and AI

- **Describe it, get a design:** type or speak, for example "100×50 mm rice bag label with MRP, batch and EAN-13". Tick **change current** to adjust the open design, for example "make the MRP bigger".
- **Picture to label (AI):** photograph an existing label. AI rebuilds it as editable objects, with barcodes and QR data read from the picture.
- **Picture to PRN:** choose language and dpi. A logo becomes a printer graphic; a label photo becomes printer code.

AI uses a monthly allowance per account or company. The picture is used only to build the design.

---

## 11. PRN files: preview, paste and convert

- **Open .prn:** Tools → Printer files → Open .prn…, or the welcome card.
- **Paste printer code:** paste TSPL, ZPL, EPL2, DPL, SBPL, Fingerprint/DP or CPCL code.
- **Preview** shows the label exactly as the printer will print it, with the language detected automatically.
- **Edit in designer** (or **Bring into designer**) converts the code into editable objects.
- **Download .prn** (File → Save) writes the current design as printer code.

---

## 12. Wristbands

**File → New wristband ▸**

| Band | Size | Contents |
|---|---|---|
| Hospital: adult | 30 × 279 mm | Name, MRN, date of birth, sex, ward/bed, admission date, Code 128 and DataMatrix of the MRN |
| Hospital: child | 25 × 178 mm | Same as adult, smaller text |
| Hospital: infant | 25 × 152 mm | Name, MRN, date of birth, sex, Code 128 |
| Event or entry pass | 25 × 254 mm | Event, guest, valid date, running number, entry QR |
| Blank | 25 × 254 mm | Empty band |

- Printers: Zebra ZD510-HC and HC100 (300 dpi, ZPL), or any desktop printer loaded with wristband rolls.
- The design runs along the band; the screen shows it the readable way round.
- Patient details are **asked when printing**, so they are never stored in the design. Use **Print and next** for the next patient.
- Do a test print first: the printable area after the clasp differs between brands.

---

## 13. Printing

Click **Print** at the start of the **Edit** tab (the ribbon shown when LabelDesk opens), or **File → Print label…**, or press Ctrl+P.

**Print modes**

| Mode | Use for |
|---|---|
| **Printer commands** | Thermal label printers. Sharpest and fastest. Needs the LabelDesk Print Agent (or QZ Tray) on the computer |
| **Image via driver** | Any printer with a Windows/Mac driver; colour labels |
| **PDF to the printer** | Printers that print PDF, and Mac drivers |

**Print window**
- Printer, copies, record selection, the data entry form, **Print 1 test label**.
- **Label outline** for PDF and laser printing: none, square, or rounded corners.
- **After printing** (Printer commands mode, TSC TSPL and Zebra ZPL):

  | Choice | What the printer does | Needs |
  |---|---|---|
  | As set on the printer | Nothing is sent; the printer's own setting is used | — |
  | Tear off | Stops each label at the tear bar | — |
  | Peel off each label | Peels each label from the liner; the next prints when it is taken | Peeler / label dispenser |
  | Cut after every label | Cuts each label | Cutter |
  | Cut after every … labels | Cuts after the number of labels you set (e.g. every 10) | Cutter |
  | Cut once at the end of the job | One cut after the last label | Cutter |

  The choice is remembered for each printer. The printer keeps tear, peel or cut settings for later jobs until changed. For other printer languages, and in Image or PDF mode, set tear, peel or cut on the printer or in its driver.

### LabelDesk Print Agent (direct printing from a computer)

1. Download **LabelDesk-Print-Agent.exe** from https://labeldesk.app/download/LabelDesk-Print-Agent.exe (or the link in the print window) and run it. No admin rights are needed.
2. Not needed if you use the **LabelDesk Windows app**, which has the agent built in. Keep the separate agent for phone printing while LabelDesk is closed. It installs itself for your Windows user, adds **LabelDesk Print Agent** to the Start menu, starts with Windows, and sits in the tray near the clock. Its page opens once.
3. In LabelDesk press **Print**. The print window says "Printing through the LabelDesk Print Agent" and lists the printers installed on the computer.
4. **Network printers:** tray icon → **Open Print Agent** → **Add a network printer**: name, IP address, port 9100. They then appear in LabelDesk's print window. Network printers take Printer commands only.
5. **Send a printer file:** on the agent's page, choose a .prn file and a printer → **Print file**.
6. If the browser asks to allow labeldesk.app to reach apps on this device, choose **Allow**.
7. The agent only accepts jobs from labeldesk.app and only listens on this computer. To remove it: untick **Start with Windows** in the tray menu, **Quit**, and delete the folder `%LOCALAPPDATA%\LabelDesk Print Agent`.

Windows may say "Windows protected your PC" on first run until the agent is code-signed: **More info → Run anyway**.

### QZ Tray (alternative)

LabelDesk still works with QZ Tray when the Print Agent is not running.

1. Install **QZ Tray** (free) on the Windows or Mac computer connected to the printer.
2. Start it. On the first print, allow labeldesk.app when QZ Tray asks.
3. LabelDesk lists the printers installed on that computer.

**Office, laser and inkjet printers:** use Image or PDF mode. Turn on a label outline to see the cut lines.

---

## 14. Printing from a phone

- **Phone print screen** (File → Print more): pick a design, fill in fields, print.
- **Print station** (on the PC next to the printer): File → Print more → Print station. It shows a pairing code or QR. Phones scan it once, and their jobs then print on that PC's printer.
- **With the Print Agent:** in the Print station window click **Let the Print Agent receive**. Phone jobs then print even when no browser is open on the PC, as long as the PC is on. The agent's page shows the printer used and recent jobs.
- **Make a new pairing code** disconnects old phones; they must scan again.

---

## 15. Saving and opening designs

| Where | How | Lasts | Works on |
|---|---|---|---|
| **Draft in this browser** | Automatic | Until browser data is cleared | This device and browser |
| **Recent designs (last 5)** | Automatic | Same as draft | This device and browser |
| **.ldl file** | File → Save → Save as .ldl file… (Ctrl+Shift+S) | Permanent; you keep the file | Any device: File → Open → LabelDesk file (Ctrl+O) |
| **Cloud** | File → Save → Save to cloud (Ctrl+S) | Permanent | Any device after sign-in |
| **PRN** | File → Save → Download .prn | Permanent | Printer code only, not an editable design |
| **PNG image** | File → Save → Export colour image | Permanent | Picture of the label |

- **.ldl files** are sealed with AES-256 encryption and can be sent by WhatsApp or email.
- On iPhone, Safari may clear website data after a few weeks unused. Install LabelDesk to the Home Screen, and keep important designs as .ldl or in the cloud.

---

## 16. Privacy, encryption and PIN

- **Browser copies** (draft and recent designs) are always encrypted with AES-256 before they are stored.
- **Cloud designs** and **.ldl files** are encrypted on the server.
- **PIN lock:** File → Settings → **Privacy and PIN…**
  - Turn on, change or remove a PIN (4–32 characters; 8+ for strong protection).
  - LabelDesk asks for the PIN when opened, and again after it has been away for 5, 15 or 60 minutes (your choice).
  - Optional: wipe this browser's designs after 10 wrong PINs.
  - **Forgot PIN** wipes the designs kept on that device. Cloud designs and .ldl files are not affected. Nobody can recover them without the PIN.
  - **Clear LabelDesk data…** wipes this device on demand, for example on a shared PC.
- **Not covered:** uploaded fonts are stored separately.

---

## 17. Phones and tablets: touch gestures

| Gesture | Does |
|---|---|
| Pinch | Zoom in and out |
| Tap | Select an object |
| Double-tap | Edit text |
| Long-press | Object menu (delete, font, order…) |
| Long-press empty canvas | Insert menu |
| Two-finger tap | Undo |
| Three-finger swipe up | Print |
| ✨ button | Describe bar |
| Size tag (top left) | Label setup |
| Floating bar | Zoom −, Fit, +, 1:1, ? (gesture help) |

---

## 18. Keyboard shortcuts

On a Mac, use ⌘ instead of Ctrl.

| Keys | Action | Keys | Action |
|---|---|---|---|
| Ctrl+P | Print | Ctrl+S | Save to cloud |
| Ctrl+O | Open .ldl file | Ctrl+Shift+S | Save as .ldl |
| Ctrl+Z / Ctrl+Y | Undo / Redo | Ctrl+C / Ctrl+V | Copy / Paste |
| Ctrl+D | Duplicate | Del | Delete |
| Ctrl+A | Select all | Esc | Select none |
| Tab / Shift+Tab | Next / previous object | Arrows | Move (Shift = bigger step) |
| Ctrl+B / Ctrl+I | Bold / Italic | Ctrl+] / Ctrl+[ | Bigger / smaller text |
| R / Shift+R | Turn 90° right / left | Ctrl+= / Ctrl+- | Zoom in / out |
| Ctrl+0 | Fit to window | Ctrl+1 | Actual size |

---

## 19. Settings

**File → Settings ▸**
- **Privacy and PIN…:** encryption, PIN, auto-lock, clear data.
- **My fonts…:** upload TTF, OTF, WOFF or WOFF2 fonts. Fonts belong to your company and are encrypted in the cloud. LabelDesk warns about proprietary fonts; confirm you hold a licence.
- **Calibrate screen…:** hold a card or ruler to the screen so **1:1** shows labels at real size.
- **Touch gestures…:** gesture help.
- **Completion sounds:** short sounds when a job, import or AI design finishes.

---

## 20. Accounts and companies

These are switched on once the administrator has set up the server keys.

- **Create a free account:** email and password.
- **Two-step sign-in:** an authenticator app plus one-time backup codes.
- **Company code:** a company gets a short code. People ask to join with the code; the owner approves them and sets their role (owner, admin, designer, printer).
- **Shared by a company:** design library, fonts and an AI allowance.

---

## 21. Troubleshooting

| Problem | Fix |
|---|---|
| "Direct printing needs the LabelDesk Print Agent" | Download and run the Print Agent (or start it from the Start menu), then **try again** |
| "The Print Agent found no printers" | Install the printer's Windows driver, or add it as a network printer on the agent's page |
| "Network printers take printer commands only" | Choose **Printer commands** in the print window, or print through an installed printer |
| "No printer found on this computer" | Check the printer is installed in Windows/Mac and switched on |
| Print is blurred or text is the wrong size | Use **Printer commands** mode and a printer font; check language and dpi in Label setup |
| Label prints offset | Check label size, gap and edge in Label setup; calibrate the printer's media sensor |
| Date shows the wrong time | Check the "Takes the date and time" setting; for the printer clock, set the printer's clock |
| "Cloud storage is not switched on here yet" | Sign-in is not set up yet; use Save as .ldl |
| "Could not reach LabelDesk" | Check the internet. Designing and printing still work offline; AI and cloud need internet |
| Menus look faded on a phone | Reload the page (fixed for dark mode) |
| Forgot PIN | Use **Forgot PIN** on the lock screen; then open your .ldl or cloud copy |
| Object off the label | The properties panel warns "off the label"; drag it back or reduce the size |

Help: **Tools → Talk to us**.

---

## 22. Glossary

| Term | Meaning |
|---|---|
| PRN | A file of printer commands that prints a label directly |
| TSPL / ZPL / EPL2 / DPL / SBPL / CPCL / Fingerprint | Printer command languages of TSC, Zebra, older Zebra, Datamax/Honeywell, SATO, mobile printers, Honeywell/Intermec |
| dpi | Dots per inch: 203, 300 or 600 |
| Liner | The backing paper the labels sit on |
| Gap | Space between labels on the roll |
| .ldl | LabelDesk's own encrypted design file |
| LabelDesk Print Agent | LabelDesk's own helper program that prints to installed and network printers and receives phone jobs |
| QZ Tray | Free third-party helper that lets a web page print directly to a printer |
| GS1 / AI | Global barcode standard; Application Identifiers such as (01) GTIN and (17) expiry |
| LMPC | Legal Metrology (Packaged Commodities) rules for labels on packaged goods in India |
| MRN | Medical record number on a patient wristband |

---

## 23. Change log

| Version | Date | Changes |
|---|---|---|
| 1.8 | 26 Nov 2026 | Windows app rebuilt in Go (Wails): 12 MB instead of 150 MB, Print Agent built in, download from labeldesk.app/download/LabelDesk.exe |
| 1.7 | 26 Nov 2026 | LabelDesk Print Agent (section 13): direct printing without QZ Tray, network printers by IP, phone printing with the browser closed (section 14), troubleshooting rows |
| 1.6 | 26 Nov 2026 | Android, iPhone and Windows apps (section 2): share-sheet saving on phones, Save-as dialogs and own window on Windows, offline page |
| 1.5 | 26 Nov 2026 | Edit tab ribbon starts with quick-insert buttons: Text, Barcodes ▾, Image, Database ▾ (same as the Insert tab), placed before Print |
| 1.4 | 26 Nov 2026 | Button tips: shown on hover or keyboard Tab only, not when the designer opens or on touch screens (fixes "About LabelDesk" showing on the iPhone) |
| 1.3 | 26 Nov 2026 | Print button moved to the start of the Edit tab ribbon (default tab); Don't print has its own crossed-out printer icon |
| 1.2 | 26 Nov 2026 | Orange Print button replaced by a printer icon next to the tabs and File → Print label… (with icon); phone print screen is in File → Print more |
| 1.1 | 26 Nov 2026 | Print window: After printing — tear off, peel off, cut every label, every N labels, or once per job (TSPL, ZPL) |
| 1.0 | 26 Nov 2026 | First manual: designer, Label setup in File, ribbon tabs (Edit, Insert, Data, View, Tools), date and time objects with custom formats, wristbands, recent designs, encrypted browser storage with PIN, dark-mode fix, describe bar behind ✨ on phones |
| | | *Add new rows above this line* |
