package server

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultAISystemPrompt = `You are a meticulous article summarizer for an RSS reader. Produce short, high-signal summaries that are accurate, neutral, and easy to scan.

Rules:
- Output valid Markdown only. No title, preamble, meta commentary, or closing remarks.
- Before writing, internally identify the article type, main development, key actors, strongest facts, and any important uncertainty. Do not reveal this analysis.
- Start with a single bold one-sentence TL;DR.
- Then choose the format that best fits the article:
  - For fact-dense news, announcements, explainers, or reports: 3-5 bullets ordered by importance. Each bullet <= 25 words.
  - For narrative features, analysis, interviews, reviews, or opinion pieces: one short paragraph of 2-4 sentences.
- If a paragraph summary would benefit from concrete takeaways, add 1-3 short bullets after the paragraph.
- Use Markdown emphasis intentionally to improve scanability:
  - Bold key actors, decisions, numbers, and outcomes when helpful.
  - Use italics sparingly for titles, named reports, or brief emphasis.
  - Use inline code for literal identifiers such as commands, file paths, APIs, model names, package names, or version strings when relevant.
  - Do not over-format or turn full sentences into bold or code.
- Use neutral, plain language. Do not mimic sensational, partisan, or promotional phrasing from the source.
- Use only information stated in the article. Do not add outside knowledge, assumptions, or speculation.
- Do not present opinions, allegations, predictions, or disputed claims as facts. Attribute them clearly.
- If the article presents multiple viewpoints, represent them fairly and attribute them.
- For analysis or opinion pieces, summarize the main thesis and strongest supporting points, making clear they are the author's views.
- Prefer concrete details when central: who, what, where, when, why/how, numbers, decisions, and outcomes.
- If a crucial detail is missing or unclear, note the gap briefly or omit it; never fill gaps.
- Respond in the same language as the article.
- If the input is not a substantive article (for example: paywall notice, error page, navigation page, empty text, or stub), output exactly: _No summary available._`

type aiConfig struct {
	Endpoint     string
	APIKey       string
	Model        string
	SystemPrompt string
}

func aiString(settings map[string]interface{}, key string) string {
	if v, ok := settings[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func aiBool(settings map[string]interface{}, key string) bool {
	if v, ok := settings[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

// buildAIConfig extracts AI settings from the stored settings map.
// Returns (cfg, configured). `configured` is true when endpoint, api key
// and model are all non-empty.
func buildAIConfig(settings map[string]interface{}) (aiConfig, bool) {
	cfg := aiConfig{
		Endpoint: strings.TrimSpace(aiString(settings, "ai_endpoint")),
		APIKey:   strings.TrimSpace(aiString(settings, "ai_api_key")),
		Model:    strings.TrimSpace(aiString(settings, "ai_model")),
	}
	if aiBool(settings, "ai_system_prompt_custom_enabled") {
		custom := strings.TrimSpace(aiString(settings, "ai_system_prompt_custom"))
		if custom != "" {
			cfg.SystemPrompt = custom
		}
	}
	if cfg.SystemPrompt == "" {
		cfg.SystemPrompt = defaultAISystemPrompt
	}
	configured := cfg.Endpoint != "" && cfg.APIKey != "" && cfg.Model != ""
	return cfg, configured
}

// chatURL joins the configured endpoint with /chat/completions, tolerating
// a trailing slash or an already-present /chat/completions suffix.
func chatURL(endpoint string) string {
	e := strings.TrimRight(endpoint, "/")
	if strings.HasSuffix(e, "/chat/completions") {
		return e
	}
	return e + "/chat/completions"
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type chatStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// streamSummarize POSTs a chat-completions request with stream=true and
// invokes onDelta for each content chunk. It returns the concatenated text
// on success. The provided context aborts the request on cancellation.
func streamSummarize(ctx context.Context, cfg aiConfig, article string, onDelta func(string)) (string, error) {
	if strings.TrimSpace(article) == "" {
		return "", errors.New("no article content to summarize")
	}

	reqBody := chatRequest{
		Model:  cfg.Model,
		Stream: true,
		Messages: []chatMessage{
			{Role: "system", Content: cfg.SystemPrompt},
			{Role: "user", Content: article},
		},
	}
	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", chatURL(cfg.Endpoint), bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("upstream status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var full strings.Builder
	reader := bufio.NewReaderSize(resp.Body, 64*1024)
	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 {
			line = strings.TrimRight(line, "\r\n")
			if line == "" {
				continue
			}
			if !strings.HasPrefix(line, "data:") {
				continue
			}
			data := strings.TrimSpace(line[len("data:"):])
			if data == "[DONE]" {
				return full.String(), nil
			}
			var chunk chatStreamChunk
			if jerr := json.Unmarshal([]byte(data), &chunk); jerr != nil {
				// Skip malformed/keep-alive lines.
				continue
			}
			if chunk.Error != nil {
				return "", errors.New(chunk.Error.Message)
			}
			for _, ch := range chunk.Choices {
				if ch.Delta.Content != "" {
					full.WriteString(ch.Delta.Content)
					onDelta(ch.Delta.Content)
				}
			}
		}
		if err != nil {
			if err == io.EOF {
				return full.String(), nil
			}
			if ctx.Err() != nil {
				return "", ctx.Err()
			}
			return "", err
		}
	}
}
