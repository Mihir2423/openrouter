import { Messages } from "../types";

export type LlmResponse = {
  id: string;
  object: "chat.completion";
  model: string;
  choices: {
    index: number;
    message: {
      content: string;
      role: "assistant"
    };
    finish_reason: "stop";
  }[];
  inputTokensConsumed: number;
  outputTokensConsumed: number;
  created: number;
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
    };
    finish_reason: null | "stop",
  }[];
  inputTokensConsumed?: number;
  outputTokensConsumed?: number;
};

export class BaseLlm {
  static async chat(
    completionId: string,
    model: string,
    messages: Messages,
  ): Promise<LlmResponse> {
    throw new Error("Not implemented chat function");
  }

  static streamChat(
    model: string,
    completionId: string,
    messages: Messages,
  ): AsyncGenerator<StreamChunk> {
    throw new Error("Not implemented streamChat function");
  }
}
