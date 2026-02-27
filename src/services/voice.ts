/** Voice service — ElevenLabs TTS + voice cloning status */

import type { Env } from '../types';

export async function synthesizeSpeech(
  env: Env,
  text: string,
  voiceId: string,
  emotion?: string,
): Promise<{ audio?: ArrayBuffer; error?: string }> {
  if (!env.ELEVENLABS_API_KEY) {
    return { error: 'ELEVENLABS_API_KEY not configured' };
  }

  // Emotion-based voice settings
  const emotionSettings: Record<string, { stability: number; similarity_boost: number; style: number }> = {
    neutral: { stability: 0.5, similarity_boost: 0.75, style: 0.0 },
    joy: { stability: 0.4, similarity_boost: 0.75, style: 0.5 },
    sadness: { stability: 0.6, similarity_boost: 0.8, style: 0.3 },
    love: { stability: 0.55, similarity_boost: 0.8, style: 0.4 },
    nostalgia: { stability: 0.55, similarity_boost: 0.8, style: 0.35 },
    excitement: { stability: 0.35, similarity_boost: 0.7, style: 0.6 },
    calm: { stability: 0.65, similarity_boost: 0.8, style: 0.2 },
    wisdom: { stability: 0.6, similarity_boost: 0.85, style: 0.25 },
  };

  const settings = emotionSettings[emotion ?? 'neutral'] ?? emotionSettings.neutral;

  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity_boost,
            style: settings.style,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `ElevenLabs error ${resp.status}: ${errText}` };
    }

    const audio = await resp.arrayBuffer();
    return { audio };
  } catch (e) {
    return { error: `Voice synthesis failed: ${(e as Error).message}` };
  }
}

export async function getVoiceCloneStatus(
  env: Env,
  voiceId: string,
): Promise<{ status: string; name?: string; samples?: number }> {
  if (!env.ELEVENLABS_API_KEY) {
    return { status: 'no_api_key' };
  }

  try {
    const resp = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
    });

    if (!resp.ok) return { status: 'not_found' };

    const data = (await resp.json()) as { name?: string; samples?: { sample_id: string }[] };
    return {
      status: 'active',
      name: data.name,
      samples: data.samples?.length ?? 0,
    };
  } catch {
    return { status: 'error' };
  }
}
