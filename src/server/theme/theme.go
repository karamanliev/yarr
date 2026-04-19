package theme

import (
	"encoding/json"
	"log"
	"math"
	"strconv"

	"github.com/nkanaev/yarr/src/assets"
)

type Entry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type Palette struct {
	Light   []Entry `json:"light"`
	Dark    []Entry `json:"dark"`
	Accents []Entry `json:"accents"`
}

var Themes Palette

func load() Palette {
	f, err := assets.FS.Open("themes.json")
	if err != nil {
		log.Fatalf("failed to open themes.json: %s", err)
	}
	defer f.Close()
	var p Palette
	if err := json.NewDecoder(f).Decode(&p); err != nil {
		log.Fatalf("failed to parse themes.json: %s", err)
	}
	return p
}

func init() {
	Themes = load()
}

func hexChannel(c float64) float64 {
	if c <= 0.03928 {
		return c / 12.92
	}
	return math.Pow((c+0.055)/1.055, 2.4)
}

func srgbLuminance(hex string) float64 {
	if len(hex) != 7 {
		return 0.5
	}
	parse := func(s string) float64 {
		n, err := strconv.ParseInt(s, 16, 32)
		if err != nil {
			return 0
		}
		return float64(n) / 255.0
	}
	r := hexChannel(parse(hex[1:3]))
	g := hexChannel(parse(hex[3:5]))
	b := hexChannel(parse(hex[5:7]))
	return 0.2126*r + 0.7152*g + 0.0722*b
}

func ContrastText(hex string) string {
	if srgbLuminance(hex) > 0.5 {
		return "#111111"
	}
	return "#eeeeee"
}

func pickOrFallback(entries []Entry, key, fallbackKey string) string {
	var fallback string
	for _, e := range entries {
		if e.Key == key {
			return e.Value
		}
		if e.Key == fallbackKey {
			fallback = e.Value
		}
	}
	if fallback != "" {
		return fallback
	}
	if len(entries) > 0 {
		return entries[0].Value
	}
	return "#000000"
}

func Resolve(settings map[string]interface{}) map[string]string {
	mode, _ := settings["theme_mode"].(string)
	if mode != "light" && mode != "dark" {
		mode = "dark"
	}
	lightKey, _ := settings["theme_light_variant"].(string)
	darkKey, _ := settings["theme_dark_variant"].(string)
	accentKey, _ := settings["theme_accent"].(string)

	var bg string
	if mode == "dark" {
		bg = pickOrFallback(Themes.Dark, darkKey, "black")
	} else {
		bg = pickOrFallback(Themes.Light, lightKey, "white")
	}
	accent := pickOrFallback(Themes.Accents, accentKey, "blue")
	return map[string]string{
		"mode":       mode,
		"bg":         bg,
		"text":       ContrastText(bg),
		"accent":     accent,
		"accentText": ContrastText(accent),
	}
}
