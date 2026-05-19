import { NextRequest, NextResponse } from "next/server";
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { z } from "zod";

const BBoxSchema = z.object({
  thinking: z.string().describe("Analysis reasoning"),
  bbox: z.array(z.number().min(0)).length(4).describe("Bounding box [x, y, width, height] in raw pixels"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, imageBase64, imageWidth, imageHeight } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const openaiModel = process.env.OPENAI_MODEL || "qwen-vl-max";
    const baseUrl = process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Set OPENAI_API_KEY in your .env file." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
      baseURL: baseUrl,
    });

    const client = Instructor({
      client: openai,
      mode: "FUNCTIONS"
    });

    const systemMessage = messages.find((m: { role: string }) => m.role === "system");
    const userMessages = messages.filter((m: { role: string }) => m.role === "user");
    const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : "";

    let userContent: OpenAI.Chat.ChatCompletionContentPart[];
    
    if (imageBase64) {
      userContent = [
        { type: "text", text: `${lastUserMessage}\n\nImage dimensions: ${imageWidth || "unknown"}x${imageHeight || "unknown"} pixels. Return bbox in raw pixels based on these dimensions.` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
      ];
    } else {
      userContent = [{ type: "text", text: lastUserMessage }];
    }

    const completion = await client.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: "system", content: (systemMessage?.content || "") + "\n\nIMPORTANT: Always respond with JSON." },
        { role: "user", content: userContent },
      ],
      response_model: { schema: BBoxSchema, name: "BBoxResponse" },
      max_retries: 5,
    });

    console.log("Response:", JSON.stringify(completion, null, 2));

    return NextResponse.json({
      thinking: completion.thinking,
      bbox: completion.bbox,
      text: completion.thinking,
    });
  } catch (error) {
    console.error("Chat completions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}