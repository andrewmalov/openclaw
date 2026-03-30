# Quickstart: LiteLLM-backed `web_search`

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Prerequisites

- LiteLLM Proxy reachable from the **agent** host/container.
- At least one **model/route** in LiteLLM that performs web search (e.g. Perplexity, Tavily, or Brave mapped per LiteLLM docs).

## 1. Configure LiteLLM upstream

In LiteLLM, define a model name your agents will use (example names only):

- `perplexity-search` → upstream Perplexity search/chat route
- `tavily-web` → Tavily tool/route

Use LiteLLM’s own documentation for exact YAML/UI steps.

## 2. Set agent environment variables

```bash
export LITELLM_API_KEY="sk-..."           # LiteLLM proxy key
export LITELLM_API_BASE="http://localhost:4000/v1"   # include `/v1` if that is your OpenAI-compatible root
```

Optional: `export LITELLM_WEB_SEARCH_MODEL="my-search-route"` if you omit `tools.web.search.litellm.model`.

Ensure the **gateway or agent process** that runs tools inherits these variables (systemd, Docker, Kubernetes manifest, etc.).

## 3. OpenClaw config

Minimal example (adjust to your config format):

```json
{
  "tools": {
    "web": {
      "search": {
        "enabled": true,
        "provider": "litellm",
        "litellm": {
          "model": "perplexity-search"
        }
      }
    }
  }
}
```

To rely on **auto-detect**, omit `provider` and keep only env vars set; confirm diagnostics show `litellm` selected when both key and base are present.

## 4. Verify

1. Run a short agent session that calls `web_search` with query `"OpenClaw LiteLLM"`.
2. Confirm a **completed** result (structured `results` or `content` + `citations`).
3. Temporarily unset `LITELLM_API_BASE` and confirm a **clear configuration error** (not a silent hang).
4. Set `tools.web.search.provider` to `brave` (or another configured provider) and confirm traffic **does not** use LiteLLM.

## 5. Troubleshooting

| Symptom                      | Check                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| 401 / unauthorized           | `LITELLM_API_KEY`, LiteLLM key config                                       |
| Model not found              | `tools.web.search.litellm.model` matches LiteLLM route name                 |
| Wrong upstream               | LiteLLM route mapping, not OpenClaw                                         |
| Still using Brave/Perplexity | `provider` explicit override; auto-detect order; env not visible to process |

## References

- Provider overview: `docs/providers/litellm.md` (update in implementation PR)
- Existing LiteLLM model provider spec: `specs/002-litellm-proxy-provider/spec.md`
