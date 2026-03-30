import {
  transcribeOpenAiCompatibleAudio,
  type AudioTranscriptionRequest,
  type MediaUnderstandingProvider,
} from "openclaw/plugin-sdk/media-understanding";

export const DEFAULT_LITELLM_AUDIO_MODEL = "gpt-4o-audio-preview";

export async function transcribeLiteLlmAudio(params: AudioTranscriptionRequest) {
  return await transcribeOpenAiCompatibleAudio({
    ...params,
    defaultBaseUrl: process.env.LITELLM_API_BASE?.trim() || "http://localhost:4000/v1",
    defaultModel: DEFAULT_LITELLM_AUDIO_MODEL,
  });
}

export const litellmMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: "litellm",
  capabilities: ["audio"],
  transcribeAudio: transcribeLiteLlmAudio,
};
