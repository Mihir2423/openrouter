import { Messages } from "../types";
import { BaseLlm, LlmResponse, StreamChunk } from "./Base";
import OpenAI from "openai";
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAi extends BaseLlm {
  static async chat(completionId: string, model: string, messages: Messages): Promise<LlmResponse> {
    const response = await client.responses.create({
      model: model,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    return {
      inputTokensConsumed: response.usage?.input_tokens ?? 0,
      outputTokensConsumed: response.usage?.output_tokens ?? 0,
      model,
      created: Math.floor(Date.now() / 1000),
      id: completionId,
      object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: response.output_text,
            },
            finish_reason: "stop"
          },
        ],
    };
  }

  static async *streamChat(
    model: string,
    messages: Messages,
  ): AsyncGenerator<StreamChunk> {
    const stream = await client.responses.create({
      model: model,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === "response.output_text.delta") {
        yield {
          choices: [
            {
              delta: {
                content: chunk.delta,
              },
            },
          ],
        };
      }
    }
  }
}
