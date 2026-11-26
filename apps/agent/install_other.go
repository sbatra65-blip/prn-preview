//go:build !windows

package main

func selfInstall() bool { return false }
func uninstall()        {}
