// OpenAI Whisper wrapper — voice note → transcript.

import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribe(_audio: File): Promise<string> {
  // TODO(ai): call openai.audio.transcriptions.create({ model: "whisper-1", file })
  throw new Error("not_implemented");
}
