import { definePluginEntry } from "openclaw/plugin-sdk/core";
import {
  createPluginBackedWebSearchProvider,
  getScopedCredentialValue,
  setScopedCredentialValue,
} from "openclaw/plugin-sdk/provider-web-search";

export default definePluginEntry({
  id: "litellm",
  name: "LiteLLM Plugin",
  description: "Bundled LiteLLM plugin (web search through LiteLLM Proxy)",
  register(api) {
    api.registerWebSearchProvider(
      createPluginBackedWebSearchProvider({
        id: "litellm",
        label: "LiteLLM Proxy (web search)",
        hint: "OpenAI-compatible search routes (Perplexity, Tavily, Brave, etc.) via your LiteLLM deployment",
        envVars: ["LITELLM_API_KEY"],
        placeholder: "sk-...",
        signupUrl: "https://litellm.ai",
        docsUrl: "https://github.com/andrewmalov/openclaw",
        autoDetectOrder: 5,
        getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, "litellm"),
        setCredentialValue: (searchConfigTarget, value) =>
          setScopedCredentialValue(searchConfigTarget, "litellm", value),
      }),
    );
  },
});
