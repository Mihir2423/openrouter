import { Messages } from "../types";

export type LlmResponse = {
  completions: {
    choices: {
      message: {
        content: string;
      };
    }[];
  };
  inputTokensConsumed: number;
  outputTokensConsumed: number;
};

export type StreamChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason: string | null;
  }[];
};

export function createStreamChunk(
  id: string,
  model: string,
  content: string,
  finishReason: string | null = null,
): StreamChunk {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: finishReason,
      },
    ],
  };
}

export class BaseLlm {
  static async chat(model: string, messages: Messages): Promise<LlmResponse> {
    throw new Error("Not implemented chat function");
  }

  static streamChat(
    completionId: string,
    model: string,
    messages: Messages,
  ): AsyncGenerator<StreamChunk> {
    throw new Error("Not implemented streamChat function");
  }
}
