import bearer from "@elysiajs/bearer";
import { prisma } from "db";
import { Elysia, t } from "elysia";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/OpenAi";
import { Claude } from "./llms/Claude";
import { LlmResponse, StreamChunk } from "./llms/Base";

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
        });
        const writer = stream.writable.getWriter();

        (async () => {
          let outputTokens = 0;
          let inputTokens = 0;
          let fullOutput = "";

          try {
            let streamGenerator: AsyncGenerator<StreamChunk> | null = null;

            if (
              provider.provider.name === "Google API" ||
              provider.provider.name === "Google Vertex"
            ) {
              streamGenerator = Gemini.streamChat(
                providerModelName,
                body.messages,
              );
            } else if (provider.provider.name === "OpenAI") {
              streamGenerator = OpenAi.streamChat(
                providerModelName,
                body.messages,
              );
            } else if (provider.provider.name === "Claude API") {
              streamGenerator = Claude.streamChat(
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

            await writer.write({
              choices: [
                {
                  delta: {
                    content: "",
                  },
                },
              ],
            } as any);

            const creditsUsed =
              (inputTokens * provider.inputTokenCost +
                outputTokens * provider.outputTokenCost) /
              10;

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
        response = await Gemini.chat(providerModelName, body.messages);
      }

      if (provider.provider.name === "Google Vertex") {
        response = await Gemini.chat(providerModelName, body.messages);
      }

      if (provider.provider.name === "OpenAI") {
        response = await OpenAi.chat(providerModelName, body.messages);
      }

      if (provider.provider.name === "Claude API") {
        response = await Claude.chat(providerModelName, body.messages);
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

      const outputText = response.completions.choices
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
