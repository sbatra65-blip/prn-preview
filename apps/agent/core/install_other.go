//go:build !windows

package core

func SelfInstall(name, exeName string) bool { return false }
func Uninstall(name string)               {}
