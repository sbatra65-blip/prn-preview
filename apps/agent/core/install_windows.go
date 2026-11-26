//go:build windows

package core

import (
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func installDir(name string) string {
	d := os.Getenv("LOCALAPPDATA")
	if d == "" {
		d, _ = os.UserConfigDir()
	}
	return filepath.Join(d, name)
}

func shortcutPath(name string) string {
	return filepath.Join(os.Getenv("APPDATA"), `Microsoft\Windows\Start Menu\Programs`, name+".lnk")
}

// SelfInstall copies the downloaded exe to the user's app folder (no admin rights), adds a Start-menu
// shortcut and runs the installed copy. It returns true when this process should exit.
// name is the folder and shortcut name ("LabelDesk"), exeName the installed file name.
func SelfInstall(name, exeName string) bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	dir := installDir(name)
	target := filepath.Join(dir, exeName)
	if strings.EqualFold(filepath.Clean(exe), filepath.Clean(target)) {
		return false
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return false
	}
	if err := copyFile(exe, target); err != nil {
		return false // an older copy is running: carry on from here; it answers on the same port
	}
	ps := `$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:LD_LNK);$s.TargetPath=$env:LD_EXE;$s.Description=$env:LD_NAME;$s.Save()`
	c := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", ps)
	c.Env = append(os.Environ(), "LD_LNK="+shortcutPath(name), "LD_EXE="+target, "LD_NAME="+name)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = c.Run()
	if exec.Command(target).Start() != nil {
		return false
	}
	return true
}

// Uninstall stops start-with-Windows and removes the Start-menu shortcut.
func Uninstall(name string) {
	_ = SetAutoStart(false)
	_ = os.Remove(shortcutPath(name))
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	tmp := dst + ".new"
	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err = io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	if err = out.Close(); err != nil {
		return err
	}
	_ = os.Remove(dst)
	return os.Rename(tmp, dst)
}
