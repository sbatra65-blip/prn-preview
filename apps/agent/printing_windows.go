//go:build windows

package main

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/draw"
	_ "image/png"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	winspool               = windows.NewLazySystemDLL("winspool.drv")
	gdi32                  = windows.NewLazySystemDLL("gdi32.dll")
	pEnumPrinters          = winspool.NewProc("EnumPrintersW")
	pGetDefaultPrinter     = winspool.NewProc("GetDefaultPrinterW")
	pOpenPrinter           = winspool.NewProc("OpenPrinterW")
	pClosePrinter          = winspool.NewProc("ClosePrinter")
	pStartDocPrinter       = winspool.NewProc("StartDocPrinterW")
	pEndDocPrinter         = winspool.NewProc("EndDocPrinter")
	pStartPagePrinter      = winspool.NewProc("StartPagePrinter")
	pEndPagePrinter        = winspool.NewProc("EndPagePrinter")
	pWritePrinter          = winspool.NewProc("WritePrinter")
	pDocumentProperties    = winspool.NewProc("DocumentPropertiesW")
	pCreateDC              = gdi32.NewProc("CreateDCW")
	pDeleteDC              = gdi32.NewProc("DeleteDC")
	pStartDoc              = gdi32.NewProc("StartDocW")
	pEndDoc                = gdi32.NewProc("EndDoc")
	pAbortDoc              = gdi32.NewProc("AbortDoc")
	pStartPage             = gdi32.NewProc("StartPage")
	pEndPage               = gdi32.NewProc("EndPage")
	pGetDeviceCaps         = gdi32.NewProc("GetDeviceCaps")
	pStretchDIBits         = gdi32.NewProc("StretchDIBits")
	pSetStretchBltMode     = gdi32.NewProc("SetStretchBltMode")
)

type printerInfo2 struct {
	ServerName, PrinterName, ShareName, PortName, DriverName, Comment, Location *uint16
	DevMode                                                                     uintptr
	SepFile, PrintProcessor, Datatype, Parameters                               *uint16
	SecurityDescriptor                                                          uintptr
	Attributes, Priority, DefaultPriority, StartTime, UntilTime, Status, Jobs, AveragePPM uint32
}

func u16(s string) *uint16 { p, _ := windows.UTF16PtrFromString(s); return p }

func sysPrinters() ([]Printer, error) {
	const flags = 0x2 | 0x4 // PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS
	var needed, returned uint32
	pEnumPrinters.Call(flags, 0, 2, 0, 0, uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if needed == 0 {
		return nil, nil
	}
	buf := make([]byte, needed)
	r, _, err := pEnumPrinters.Call(flags, 0, 2, uintptr(unsafe.Pointer(&buf[0])), uintptr(needed), uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if r == 0 {
		return nil, err
	}
	def := defaultPrinter()
	out := make([]Printer, 0, returned)
	size := unsafe.Sizeof(printerInfo2{})
	for i := uint32(0); i < returned; i++ {
		pi := (*printerInfo2)(unsafe.Pointer(&buf[uintptr(i)*size]))
		n := windows.UTF16PtrToString(pi.PrinterName)
		out = append(out, Printer{Name: n, Driver: windows.UTF16PtrToString(pi.DriverName), Port: windows.UTF16PtrToString(pi.PortName), Kind: "installed", Default: n == def})
	}
	return out, nil
}

func defaultPrinter() string {
	var n uint32 = 512
	b := make([]uint16, n)
	if r, _, _ := pGetDefaultPrinter.Call(uintptr(unsafe.Pointer(&b[0])), uintptr(unsafe.Pointer(&n))); r == 0 {
		return ""
	}
	return windows.UTF16ToString(b)
}

func openPrinter(name string) (uintptr, error) {
	var h uintptr
	if r, _, err := pOpenPrinter.Call(uintptr(unsafe.Pointer(u16(name))), uintptr(unsafe.Pointer(&h)), 0); r == 0 {
		return 0, fmt.Errorf("printer “%s” not found on this computer (%v)", name, err)
	}
	return h, nil
}

// sysPrintRaw sends printer commands (TSPL, ZPL…) straight to the printer, untouched by the driver.
func sysPrintRaw(name string, data []byte, title string) error {
	h, err := openPrinter(name)
	if err != nil {
		return err
	}
	defer pClosePrinter.Call(h)
	di := struct{ DocName, OutputFile, Datatype *uint16 }{u16(title), nil, u16("RAW")}
	if r, _, err := pStartDocPrinter.Call(h, 1, uintptr(unsafe.Pointer(&di))); r == 0 {
		return fmt.Errorf("the printer refused the job: %v", err)
	}
	defer pEndDocPrinter.Call(h)
	pStartPagePrinter.Call(h)
	defer pEndPagePrinter.Call(h)
	for off := 0; off < len(data); {
		chunk := data[off:]
		if len(chunk) > 1<<20 {
			chunk = chunk[:1<<20]
		}
		var written uint32
		if r, _, err := pWritePrinter.Call(h, uintptr(unsafe.Pointer(&chunk[0])), uintptr(len(chunk)), uintptr(unsafe.Pointer(&written))); r == 0 || written == 0 {
			return fmt.Errorf("sending to the printer failed: %v", err)
		}
		off += int(written)
	}
	return nil
}

// sysPrintImages prints PNG pictures through the printer driver, one label row per page,
// at the exact label size (the driver gets a custom paper size in 0.1 mm).
func sysPrintImages(name string, pngs [][]byte, wmm, hmm float64, copies int, title string) error {
	h, err := openPrinter(name)
	if err != nil {
		return err
	}
	defer pClosePrinter.Call(h)
	dev := u16(name)
	need, _, _ := pDocumentProperties.Call(0, h, uintptr(unsafe.Pointer(dev)), 0, 0, 0)
	if int32(need) <= 0 {
		return errors.New("could not read the printer settings")
	}
	dm := make([]byte, need)
	if r, _, _ := pDocumentProperties.Call(0, h, uintptr(unsafe.Pointer(dev)), uintptr(unsafe.Pointer(&dm[0])), 0, 2); int32(r) < 0 {
		return errors.New("could not read the printer settings")
	}
	// DEVMODEW: dmFields @68, dmOrientation @72, dmPaperSize @74, dmPaperLength @76, dmPaperWidth @78
	put16 := func(off int, v uint16) { dm[off], dm[off+1] = byte(v), byte(v>>8) }
	fields := uint32(dm[68]) | uint32(dm[69])<<8 | uint32(dm[70])<<16 | uint32(dm[71])<<24
	fields |= 0x1 | 0x2 | 0x4 | 0x8
	dm[68], dm[69], dm[70], dm[71] = byte(fields), byte(fields>>8), byte(fields>>16), byte(fields>>24)
	put16(72, 1)   // portrait
	put16(74, 256) // DMPAPER_USER
	put16(76, uint16(hmm*10+0.5))
	put16(78, uint16(wmm*10+0.5))
	pDocumentProperties.Call(0, h, uintptr(unsafe.Pointer(dev)), uintptr(unsafe.Pointer(&dm[0])), uintptr(unsafe.Pointer(&dm[0])), 2|8)

	hdc, _, _ := pCreateDC.Call(uintptr(unsafe.Pointer(u16("WINSPOOL"))), uintptr(unsafe.Pointer(dev)), 0, uintptr(unsafe.Pointer(&dm[0])))
	if hdc == 0 {
		return errors.New("could not open the printer driver")
	}
	defer pDeleteDC.Call(hdc)
	cap := func(i uintptr) int { r, _, _ := pGetDeviceCaps.Call(hdc, i); return int(int32(r)) }
	dpiX, dpiY, offX, offY := cap(88), cap(90), cap(112), cap(113)
	if dpiX <= 0 || dpiY <= 0 {
		return errors.New("the printer driver gave no resolution")
	}
	dw, dh := int(wmm/25.4*float64(dpiX)+0.5), int(hmm/25.4*float64(dpiY)+0.5)

	type docInfo struct {
		Size                         int32
		DocName, Output, Datatype    *uint16
		Type                         uint32
	}
	di := docInfo{DocName: u16(title)}
	di.Size = int32(unsafe.Sizeof(di))
	if r, _, err := pStartDoc.Call(hdc, uintptr(unsafe.Pointer(&di))); int32(r) <= 0 {
		return fmt.Errorf("the printer refused the job: %v", err)
	}
	ok := false
	defer func() {
		if ok {
			pEndDoc.Call(hdc)
		} else {
			pAbortDoc.Call(hdc)
		}
	}()
	pSetStretchBltMode.Call(hdc, 3) // COLORONCOLOR keeps barcode edges sharp
	for c := 0; c < copies; c++ {
		for i, p := range pngs {
			img, _, err := image.Decode(bytes.NewReader(p))
			if err != nil {
				return fmt.Errorf("picture %d could not be read", i+1)
			}
			bits, bmi := dib24(img)
			if r, _, _ := pStartPage.Call(hdc); int32(r) <= 0 {
				return errors.New("the printer stopped the job")
			}
			b := img.Bounds()
			pStretchDIBits.Call(hdc, uintptr(int32(-offX)), uintptr(int32(-offY)), uintptr(dw), uintptr(dh), 0, 0, uintptr(b.Dx()), uintptr(b.Dy()),
				uintptr(unsafe.Pointer(&bits[0])), uintptr(unsafe.Pointer(&bmi)), 0, 0x00CC0020)
			if r, _, _ := pEndPage.Call(hdc); int32(r) <= 0 {
				return errors.New("the printer stopped the job")
			}
		}
	}
	ok = true
	return nil
}

type bitmapInfoHeader struct {
	Size                       uint32
	Width, Height              int32
	Planes, BitCount           uint16
	Compression, SizeImage     uint32
	XPelsPerMeter, YPelsPerMeter int32
	ClrUsed, ClrImportant      uint32
}

// dib24 turns a picture into a top-down 24-bit Windows bitmap (white behind transparent parts).
func dib24(src image.Image) ([]byte, bitmapInfoHeader) {
	b := src.Bounds()
	rgba := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(rgba, rgba.Bounds(), image.White, image.Point{}, draw.Src)
	draw.Draw(rgba, rgba.Bounds(), src, b.Min, draw.Over)
	w, h := b.Dx(), b.Dy()
	stride := (w*3 + 3) &^ 3
	out := make([]byte, stride*h)
	for y := 0; y < h; y++ {
		row := rgba.Pix[y*rgba.Stride:]
		o := out[y*stride:]
		for x := 0; x < w; x++ {
			o[x*3], o[x*3+1], o[x*3+2] = row[x*4+2], row[x*4+1], row[x*4]
		}
	}
	hdr := bitmapInfoHeader{Width: int32(w), Height: -int32(h), Planes: 1, BitCount: 24, SizeImage: uint32(len(out))}
	hdr.Size = uint32(unsafe.Sizeof(hdr))
	return out, hdr
}

var _ = syscall.EINVAL
