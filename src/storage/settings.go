package storage

import (
	"database/sql"
	"encoding/json"
	"log"
)

func settingsDefaults() map[string]any {
	return map[string]any{
		"filter":                          "",
		"feed":                            "",
		"feed_list_width":                 300,
		"item_list_width":                 300,
		"sort_newest_first":               true,
		"theme_name":                      "light",
		"theme_font":                      "",
		"theme_size":                      1,
		"theme_auto":                      false,
		"theme_mode":                      "",
		"theme_light_variant":             "white",
		"theme_dark_variant":              "black",
		"theme_accent":                    "blue",
		"refresh_rate":                    0,
		"ai_endpoint":                     "",
		"ai_api_key":                      "",
		"ai_model":                        "",
		"ai_system_prompt_custom_enabled": false,
		"ai_system_prompt_custom":         "",
		"language":                        "en",
	}
}

func (s *Storage) GetSettingsValue(key string) any {
	row := s.db.QueryRow(`select val from settings where key=:key`, sql.Named("key", key))
	if row == nil {
		return settingsDefaults()[key]
	}
	var val []byte
	row.Scan(&val)
	if len(val) == 0 {
		return nil
	}
	var valDecoded any
	if err := json.Unmarshal([]byte(val), &valDecoded); err != nil {
		log.Print(err)
		return nil
	}
	return valDecoded
}

func (s *Storage) GetSettingsValueInt64(key string) int64 {
	val := s.GetSettingsValue(key)
	if val != nil {
		if fval, ok := val.(float64); ok {
			return int64(fval)
		}
	}
	return 0
}

func (s *Storage) GetSettings() map[string]any {
	defaults := settingsDefaults()
	result := settingsDefaults()
	rows, err := s.db.Query(`select key, val from settings;`)
	if err != nil {
		log.Print(err)
		return result
	}
	for rows.Next() {
		var key string
		var val []byte
		var valDecoded any

		rows.Scan(&key, &val)
		if err = json.Unmarshal([]byte(val), &valDecoded); err != nil {
			log.Print(err)
			continue
		}
		if _, ok := defaults[key]; !ok {
			continue
		}
		result[key] = valDecoded
	}
	return result
}

func (s *Storage) UpdateSettings(kv map[string]any) bool {
	defaults := settingsDefaults()
	for key, val := range kv {
		if _, ok := defaults[key]; !ok {
			continue
		}
		valEncoded, err := json.Marshal(val)
		if err != nil {
			log.Print(err)
			return false
		}
		_, err = s.db.Exec(`
			insert into settings (key, val) values (:key, :val)
			on conflict (key) do update set val=:val`,
			sql.Named("key", key),
			sql.Named("val", valEncoded),
		)
		if err != nil {
			log.Print(err)
			return false
		}
	}
	return true
}
