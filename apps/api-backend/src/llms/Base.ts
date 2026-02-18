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
  choices: {
    delta: {
      content: string;
    };
  }[];
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
    messages: Messages,
  ): AsyncGenerator<StreamChunk> {
    throw new Error("Not implemented streamChat function");
  }
}
