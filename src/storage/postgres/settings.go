package postgres

import (
	"encoding/json"
	"log"

	"github.com/nkanaev/yarr/src/storage/model"
)

func (s *PostgresStorage) GetSettings() model.Settings {
	result := model.SettingsDefault()
	rows, err := s.db.Query(`select key, val from settings;`)
	if err != nil {
		log.Print(err)
		return result
	}
	defer rows.Close()

	for rows.Next() {
		var key string
		var val []byte
		rows.Scan(&key, &val)

		switch key {
		case "filter":
			json.Unmarshal(val, &result.Filter)
		case "feed":
			json.Unmarshal(val, &result.Feed)
		case "feed_list_width":
			json.Unmarshal(val, &result.FeedListWidth)
		case "item_list_width":
			json.Unmarshal(val, &result.ItemListWidth)
		case "sort_newest_first":
			json.Unmarshal(val, &result.SortNewestFirst)
		case "theme_name":
			json.Unmarshal(val, &result.ThemeName)
		case "theme_font":
			json.Unmarshal(val, &result.ThemeFont)
		case "theme_size":
			json.Unmarshal(val, &result.ThemeSize)
		case "theme_auto":
			json.Unmarshal(val, &result.ThemeAuto)
		case "theme_mode":
			json.Unmarshal(val, &result.ThemeMode)
		case "theme_light_variant":
			json.Unmarshal(val, &result.ThemeLightVariant)
		case "theme_dark_variant":
			json.Unmarshal(val, &result.ThemeDarkVariant)
		case "theme_accent":
			json.Unmarshal(val, &result.ThemeAccent)
		case "refresh_rate":
			json.Unmarshal(val, &result.RefreshRate)
		case "language":
			json.Unmarshal(val, &result.Language)
		case "ai_endpoint":
			json.Unmarshal(val, &result.AiEndpoint)
		case "ai_api_key":
			json.Unmarshal(val, &result.AiApiKey)
		case "ai_model":
			json.Unmarshal(val, &result.AiModel)
		case "ai_system_prompt_custom_enabled":
			json.Unmarshal(val, &result.AiSystemPromptCustomEnabled)
		case "ai_system_prompt_custom":
			json.Unmarshal(val, &result.AiSystemPromptCustom)
		}
	}
	return result
}

func (s *PostgresStorage) UpdateSettings(params model.UpdateSettingsParams) bool {
	tx, err := s.db.Begin()
	if err != nil {
		log.Print(err)
		return false
	}
	defer tx.Rollback()

	update := func(key string, val any) error {
		valEncoded, err := json.Marshal(val)
		if err != nil {
			return err
		}
		_, err = tx.Exec(`
			insert into settings (key, val) values ($1, $2)
			on conflict (key) do update set val = $2`,
			key,
			valEncoded,
		)
		return err
	}

	var errs []error
	if params.Filter != nil {
		errs = append(errs, update("filter", *params.Filter))
	}
	if params.Feed != nil {
		errs = append(errs, update("feed", *params.Feed))
	}
	if params.FeedListWidth != nil {
		errs = append(errs, update("feed_list_width", *params.FeedListWidth))
	}
	if params.ItemListWidth != nil {
		errs = append(errs, update("item_list_width", *params.ItemListWidth))
	}
	if params.SortNewestFirst != nil {
		errs = append(errs, update("sort_newest_first", *params.SortNewestFirst))
	}
	if params.ThemeName != nil {
		errs = append(errs, update("theme_name", *params.ThemeName))
	}
	if params.ThemeFont != nil {
		errs = append(errs, update("theme_font", *params.ThemeFont))
	}
	if params.ThemeSize != nil {
		errs = append(errs, update("theme_size", *params.ThemeSize))
	}
	if params.ThemeAuto != nil {
		errs = append(errs, update("theme_auto", *params.ThemeAuto))
	}
	if params.ThemeMode != nil {
		errs = append(errs, update("theme_mode", *params.ThemeMode))
	}
	if params.ThemeLightVariant != nil {
		errs = append(errs, update("theme_light_variant", *params.ThemeLightVariant))
	}
	if params.ThemeDarkVariant != nil {
		errs = append(errs, update("theme_dark_variant", *params.ThemeDarkVariant))
	}
	if params.ThemeAccent != nil {
		errs = append(errs, update("theme_accent", *params.ThemeAccent))
	}
	if params.RefreshRate != nil {
		errs = append(errs, update("refresh_rate", *params.RefreshRate))
	}
	if params.Language != nil {
		errs = append(errs, update("language", *params.Language))
	}
	if params.AiEndpoint != nil {
		errs = append(errs, update("ai_endpoint", *params.AiEndpoint))
	}
	if params.AiApiKey != nil {
		errs = append(errs, update("ai_api_key", *params.AiApiKey))
	}
	if params.AiModel != nil {
		errs = append(errs, update("ai_model", *params.AiModel))
	}
	if params.AiSystemPromptCustomEnabled != nil {
		errs = append(errs, update("ai_system_prompt_custom_enabled", *params.AiSystemPromptCustomEnabled))
	}
	if params.AiSystemPromptCustom != nil {
		errs = append(errs, update("ai_system_prompt_custom", *params.AiSystemPromptCustom))
	}

	for _, err := range errs {
		if err != nil {
			log.Print(err)
			return false
		}
	}

	if err := tx.Commit(); err != nil {
		log.Print(err)
		return false
	}
	return true
}
