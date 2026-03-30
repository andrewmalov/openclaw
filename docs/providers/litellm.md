---
summary: "Run OpenClaw through LiteLLM Proxy for unified model access and cost tracking"
read_when:
  - You want to route OpenClaw through a LiteLLM proxy
  - You need cost tracking, logging, or model routing through LiteLLM
---

# LiteLLM

[LiteLLM](https://litellm.ai) is an open-source LLM gateway that provides a unified API to 100+ model providers. Route OpenClaw through LiteLLM to get centralized cost tracking, logging, and the flexibility to switch backends without changing your OpenClaw config.

## Why use LiteLLM with OpenClaw?

- **Cost tracking** — See exactly what OpenClaw spends across all models
- **Model routing** — Switch between Claude, GPT-4, Gemini, Bedrock without config changes
- **Virtual keys** — Create keys with spend limits for OpenClaw
- **Logging** — Full request/response logs for debugging
- **Fallbacks** — Automatic failover if your primary provider is down

## Quick start

### Via onboarding

```bash
openclaw onboard --auth-choice litellm-api-key
```

### Manual setup

1. Start LiteLLM Proxy:

```bash
pip install 'litellm[proxy]'
litellm --model claude-opus-4-6
```

2. Point OpenClaw to LiteLLM:

```bash
export LITELLM_API_KEY="your-litellm-key"

openclaw
```

That's it. OpenClaw now routes through LiteLLM.

## Configuration

### Environment variables

```bash
export LITELLM_API_KEY="sk-litellm-key"
```

### Config file

```json5
{
  models: {
    providers: {
      litellm: {
        baseUrl: "http://localhost:4000",
        apiKey: "${LITELLM_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "claude-opus-4-6",
            name: "Claude Opus 4.6",
            reasoning: true,
            input: ["text", "image"],
            contextWindow: 200000,
            maxTokens: 64000,
          },
          {
            id: "gpt-4o",
            name: "GPT-4o",
            reasoning: false,
            input: ["text", "image"],
            contextWindow: 128000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: { primary: "litellm/claude-opus-4-6" },
    },
  },
}
```

## Virtual keys

Create a dedicated key for OpenClaw with spend limits:

```bash
curl -X POST "http://localhost:4000/key/generate" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "openclaw",
    "max_budget": 50.00,
    "budget_duration": "monthly"
  }'
```

Use the generated key as `LITELLM_API_KEY`.

## Web search (`web_search` tool)

You can route the agent **`web_search`** tool through LiteLLM so upstream search APIs (Perplexity, Tavily, Brave, and others) are configured only in LiteLLM.

### Environment variables

```bash
export LITELLM_API_KEY="your-litellm-key"
export LITELLM_API_BASE="http://localhost:4000/v1"
```

Optional: `LITELLM_WEB_SEARCH_MODEL` if you do not set `tools.web.search.litellm.model` in config.

### Config example

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "litellm",
        litellm: {
          model: "my-search-route",
        },
      },
    },
  },
}
```

The **`model`** value must match a LiteLLM route or model name that performs web search. Base URL resolution order: `LITELLM_API_BASE`, then `tools.web.search.litellm.baseUrl`, then `models.providers.litellm.baseUrl`.

When both `LITELLM_API_KEY` and `LITELLM_API_BASE` are set and `tools.web.search.provider` is omitted, OpenClaw **prefers** the `litellm` search provider over other bundled providers (for example Brave).

## Voice messages (inbound transcription + outbound TTS)

When `LITELLM_API_KEY` is set, OpenClaw can route **inbound voice** transcription through the bundled LiteLLM media provider (OpenAI-compatible `/audio/transcriptions`). The default transcription model is **`gpt-4o-audio-preview`** unless you override it under `tools.media.audio.models` or your agent media settings.

For **outbound speech**, if your OpenAI-compatible TTS `baseUrl` matches `LITELLM_API_BASE` (after trimming trailing slashes) and you do not set `messages.tts.openai.model`, synthesis defaults to **`gpt-4o-audio-preview`** for parity with the inbound path.

Set the same environment variables as for web search:

```bash
export LITELLM_API_KEY="your-litellm-key"
export LITELLM_API_BASE="http://localhost:4000/v1"
```

## Model routing

LiteLLM can route model requests to different backends. Configure in your LiteLLM `config.yaml`:

```yaml
model_list:
  - model_name: claude-opus-4-6
    litellm_params:
      model: claude-opus-4-6
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_key: os.environ/OPENAI_API_KEY
```

OpenClaw keeps requesting `claude-opus-4-6` — LiteLLM handles the routing.

## Viewing usage

Check LiteLLM's dashboard or API:

```bash
# Key info
curl "http://localhost:4000/key/info" \
  -H "Authorization: Bearer sk-litellm-key"

# Spend logs
curl "http://localhost:4000/spend/logs" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

## Notes

- LiteLLM runs on `http://localhost:4000` by default
- OpenClaw connects via the OpenAI-compatible `/v1/chat/completions` endpoint
- All OpenClaw features work through LiteLLM — no limitations

## See also

- [LiteLLM Docs](https://docs.litellm.ai)
- [Model Providers](/concepts/model-providers)
