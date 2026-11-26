//go:build !windows

package main

import "errors"

func autoStartSupported() bool   { return false }
func autoStartOn() bool          { return false }
func setAutoStart(on bool) error {
	if !on {
		return nil
	}
	return errors.New("start-with-computer is set up by the installer on this system")
}
