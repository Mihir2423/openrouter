import Anthropic from "@anthropic-ai/sdk";
import { Messages } from "../types";
import { BaseLlm, LlmResponse, StreamChunk } from "./Base";
import { TextBlock } from "@anthropic-ai/sdk/resources";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class Claude extends BaseLlm {
  static async chat(completionId: string, model: string, messages: Messages): Promise<LlmResponse> {
    const response = await client.messages.create({
      max_tokens: 2048,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      model: model,
    });

    return {
      outputTokensConsumed: response.usage.output_tokens,
      inputTokensConsumed: response.usage.input_tokens,
      object: "chat.completion",
      id: completionId,
      created: Math.floor(Date.now() / 1000),
      model,
      choices: response.content.map((content) => ({
          index: 0,
          message: {
            content: (content as TextBlock).text,
            role: "assistant"
          },
          finish_reason:"stop"
        })),
    };
  }

  static async *streamChat(
    model: string,
    messages: Messages,
  ): AsyncGenerator<StreamChunk> {
    const stream = await client.messages.create({
      max_tokens: 2048,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      model: model,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta") {
        const delta = chunk.delta as { text?: string };
        if (delta.text) {
          yield {
            choices: [
              {
                delta: {
                  content: delta.text,
                },
              },
            ],
          };
        }
      }
    }
  }
}
