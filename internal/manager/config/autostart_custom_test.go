package config

import "testing"

func TestAutostartDefaultsCustom(t *testing.T) {
	config := InitializeEmpty()
	if config.GetAutostartVideo() || config.GetAutostartVideoOnPlaySelected() {
		t.Fatal("both Auto Start settings must default to disabled")
	}

	for _, setting := range []string{AutostartVideo, AutostartVideoOnPlaySelected} {
		config.SetInterface(setting, true)
	}
	if !config.GetAutostartVideo() || !config.GetAutostartVideoOnPlaySelected() {
		t.Fatal("explicit Auto Start preferences must be preserved")
	}
	for _, setting := range []string{AutostartVideo, AutostartVideoOnPlaySelected} {
		config.SetInterface(setting, false)
	}
	if config.GetAutostartVideo() || config.GetAutostartVideoOnPlaySelected() {
		t.Fatal("both Auto Start settings must stay disabled when saved as false")
	}
}
