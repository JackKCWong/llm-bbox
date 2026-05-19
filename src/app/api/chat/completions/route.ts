import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const BBoxSchema = {
  thinking: "{think}",
  bbox: "[x, y, width, height]",
};

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

    const systemMessage = messages.find((m: { role: string }) => m.role === "system");
    const userMessages = messages.filter((m: { role: string }) => m.role === "user");
    const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : "";

    let userContent: OpenAI.Responses.ResponseInputItem[];

    if (imageBase64) {
      userContent = [
        {
          type: "input_image",
          image_url: `data:image/jpeg;base64,${imageBase64}`,
        },
        {
          type: "input_text",
          text: `${lastUserMessage}\n\nImage dimensions: ${imageWidth || "unknown"}x${imageHeight || "unknown"} pixels. Return bbox in raw pixels based on these dimensions.`,
        },
      ];
    } else {
      userContent = [{ type: "input_text", text: lastUserMessage }];
    }

    const response = await openai.responses.create({
      model: openaiModel,
      input: [
        {
          role: "developer",
          content: (systemMessage?.content || "") + "\n\nIMPORTANT: Always respond with JSON in the format: {\"thinking\": \"...\", \"bbox\": [x, y, width, height]}.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      text: {
        format: {
          type: "json_object",
          value: BBoxSchema,
        },
      },
      reasoning: {
        type: "thinking",
        title: "Analysis",
        description: "Analysis reasoning for bbox detection",
        enable: true,
      },
      tools: [
          { type: "code_interpreter" },
        ],
    });

    console.log("Response:", JSON.stringify(response, null, 2));

    let parsed = { thinking: "", bbox: [] as number[] };
    for (const item of response.output) {
      if (item.type === "reasoning") {
        parsed.thinking = item.raw;
      } else if (item.type === "message" && item.content) {
        for (const content of item.content) {
          if (content.type === "output_text") {
            const text = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            parsed = JSON.parse(text);
          }
        }
      }
    }
    return NextResponse.json({
      thinking: parsed.thinking,
      bbox: parsed.bbox,
      text: parsed.thinking,
    });
  } catch (error) {
    console.error("Chat completions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}