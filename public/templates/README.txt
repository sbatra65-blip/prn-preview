LMPC label templates - Legal Metrology (Packaged Commodities) Rules, 2011, as amended to Feb 2026
Sample data only. Test-print every file on the target printer before production use.

Templates
  LM-01  50 x 38 mm   Compact retail label (panel up to 100 cm2, 1.5 mm text)
  LM-02  75 x 50 mm   Standard retail label with EAN-13 (panel up to 100 cm2)
  LM-03  100 x 75 mm  Retail label, EAN-13 + GS1 DataMatrix (Sunrise 2027 dual marking; panel 100-500 cm2, 2.5 mm)
  LM-04  100 x 150 mm Imported product, sold by number, with dimensions (panel 500-2500 cm2, 4 mm)
  LM-05  100 x 150 mm Wholesale carton label (Rule 24) with GS1-128

Files per template
  *_TSPL_{203,300,600}dpi.prn            TSC printers (TSPL2)
  *_ZPL_{203,300,600}dpi.prn             Zebra; Honeywell, Printronix and TSC in ZPL emulation
  *_PGL-Printronix_{203,300,600}dpi.prn  Printronix native IGP/PGL (no GS1 DataMatrix; use ZPL for 2D)
  *_EPL2_203dpi.prn                      Older Zebra/Eltron EPL2 (no GS1 DataMatrix)
  *_template.json                        Design spec (positions in mm, LMPC class)
  *_preview.png                          Rendered preview

Notes
  - Prices use "Rs." because built-in printer fonts lack the Rupee sign.
  - TSPL text uses scalable font "0" with sizes in points; PGL uses ALPHA POINT sizes.
  - GS1 DataMatrix: TSPL uses c126 escape (~1 = FNC1); ZPL uses ^BX escape "_" (_1 = FNC1).
  - Send a file raw to the printer, e.g. copy /b file.prn \\PC\PrinterShare  or  nc <printer-ip> 9100 < file.prn
  - gen.py regenerates all files from one layout definition.
