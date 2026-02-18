import bearer from "@elysiajs/bearer";
import { prisma } from "db";
import { Elysia, t } from "elysia";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/OpenAi";
import { Claude } from "./llms/Claude";
import { LlmResponse, StreamChunk } from "./llms/Base";
import { generateCompletionId } from "./utils/generate-completion";

const app = new Elysia()
  .use(bearer())
  .post(
    "/api/v1/chat/completions",
    async ({ status, bearer: apiKey, body }) => {
      const model = body.model;
      const [_companyName, providerModelName] = model.split("/");
      const apiKeyDb = await prisma.apiKey.findFirst({
        where: {
          apiKey,
          disabled: false,
          deleted: false,
        },
        select: {
          id: true,
          user: true,
        },
      });

      if (!apiKeyDb) {
        return status(403, {
          message: "Invalid api key",
        });
      }

      if (apiKeyDb?.user.credits <= 0) {
        return status(403, {
          message: "You dont have enough credits in your db",
        });
      }

      const modelDb = await prisma.model.findFirst({
        where: {
          slug: model,
        },
      });

      if (!modelDb) {
        return status(403, {
          message: "This is an invalid model we dont support",
        });
      }

      const providers = await prisma.modelProviderMapping.findMany({
        where: {
          modelId: modelDb.id,
        },
        include: {
          provider: true,
        },
      });

      const provider = providers[Math.floor(Math.random() * providers.length)];

      if (body.stream) {
        const encoder = new TextEncoder();
        const stream = new TransformStream({
          transform(chunk: StreamChunk, controller) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          },
          flush(controller) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          },
        });
        const writer = stream.writable.getWriter();

        (async () => {
          let outputTokens = 0;
          let inputTokens = 0;
          let fullOutput = "";

          try {
            let streamGenerator: AsyncGenerator<StreamChunk> | null = null;
            const completionId = generateCompletionId();
            if (
              provider.provider.name === "Google API" ||
              provider.provider.name === "Google Vertex"
            ) {
              streamGenerator = Gemini.streamChat(
                completionId,
                providerModelName,
                body.messages,
              );
            } else if (provider.provider.name === "OpenAI") {
              streamGenerator = OpenAi.streamChat(
                completionId,
                providerModelName,
                body.messages,
              );
            } else if (provider.provider.name === "Claude API") {
              streamGenerator = Claude.streamChat(
                completionId,
                providerModelName,
                body.messages,
              );
            }

            if (!streamGenerator) {
              await writer.write({
                choices: [
                  {
                    delta: {
                      content: "No provider found for this model",
                    },
                  },
                ],
              } as any);
              await writer.close();
              return;
            }

            inputTokens = body.messages.reduce(
              (acc, msg) => acc + Math.ceil(msg.content.length / 4),
              0,
            );

            for await (const chunk of streamGenerator) {
              await writer.write(chunk);
              if (chunk.choices[0]?.delta?.content) {
                outputTokens += Math.ceil(
                  chunk.choices[0].delta.content.length / 4,
                );
                fullOutput += chunk.choices[0].delta.content;
              }
            }
            const creditsUsed =
              (inputTokens * provider.inputTokenCost +
                outputTokens * provider.outputTokenCost) /
              10;

            await writer.write({
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: providerModelName,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: "stop",
                },
              ],
              inputTokensConsumed: inputTokens,
              outputTokensConsumed: outputTokens
            });




            await prisma.conversation.create({
              data: {
                userId: apiKeyDb.user.id,
                apiKeyId: apiKeyDb.id,
                modelProviderMappingId: provider.id,
                input: JSON.stringify(body.messages),
                output: fullOutput,
                inputTokenCount: inputTokens,
                outputTokenCount: outputTokens,
              },
            });

            await prisma.user.update({
              where: { id: apiKeyDb.user.id },
              data: { credits: { decrement: creditsUsed } },
            });
            await prisma.apiKey.update({
              where: { apiKey },
              data: { creditsConsumed: { increment: creditsUsed } },
            });
          } catch (error) {
            console.error("Streaming error:", error);
          } finally {
            await writer.close();
          }
        })();

        return new Response(stream.readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      let response: LlmResponse | null = null;
      if (provider.provider.name === "Google API") {
      const completionId = generateCompletionId();
        response = await Gemini.chat(completionId, providerModelName, body.messages);
      }

      if (provider.provider.name === "Google Vertex") {
        const completionId = generateCompletionId();
        response = await Gemini.chat(completionId, providerModelName, body.messages);
      }

      if (provider.provider.name === "OpenAI") {
        const completionId = generateCompletionId();
        response = await OpenAi.chat(completionId, providerModelName, body.messages);
      }

      if (provider.provider.name === "Claude API") {
        const completionId = generateCompletionId();
        response = await Claude.chat(completionId, providerModelName, body.messages);
      }

      if (!response) {
        return status(403, {
          message: "No provider found for this model",
        });
      }

      const creditsUsed =
        (response.inputTokensConsumed * provider.inputTokenCost +
          response.outputTokensConsumed * provider.outputTokenCost) /
        10;

      const outputText = response.choices
        .map((choice) => choice.message.content)
        .join("");

      await prisma.conversation.create({
        data: {
          userId: apiKeyDb.user.id,
          apiKeyId: apiKeyDb.id,
          modelProviderMappingId: provider.id,
          input: JSON.stringify(body.messages),
          output: outputText,
          inputTokenCount: response.inputTokensConsumed,
          outputTokenCount: response.outputTokensConsumed,
        },
      });

      console.log(creditsUsed);
      const res = await prisma.user.update({
        where: {
          id: apiKeyDb.user.id,
        },
        data: {
          credits: {
            decrement: creditsUsed,
          },
        },
      });
      console.log(res);
      const res2 = await prisma.apiKey.update({
        where: {
          apiKey: apiKey,
        },
        data: {
          creditsConsumed: {
            increment: creditsUsed,
          },
        },
      });
      console.log(res2);

      return response;
    },
    {
      body: Conversation,
    },
  )
  .listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
