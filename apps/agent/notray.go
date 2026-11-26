//go:build !windows && !linux

package main

func trayAvailable() bool { return false }
func runTray()            {}
