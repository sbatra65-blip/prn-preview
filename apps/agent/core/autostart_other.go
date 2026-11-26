//go:build !windows

package core

import "errors"

func AutoStartSupported() bool   { return false }
func AutoStartOn() bool          { return false }
func SetAutoStart(on bool) error {
	if !on {
		return nil
	}
	return errors.New("start-with-computer is set up by the installer on this system")
}
