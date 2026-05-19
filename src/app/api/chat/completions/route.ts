import { NextRequest, NextResponse } from "next/server";

interface BBox {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, imageBase64 } = body;

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

    const chatMessages: ChatMessage[] = [];

    messages.forEach((msg: ChatMessage) => {
      if (msg.role === "system") {
        chatMessages.push({
          role: "system",
          content: msg.content + "\n\nIMPORTANT: Always respond with valid JSON containing 'bboxes' array and 'text' field.",
        });
      } else {
        chatMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    });

    const imageContent = imageBase64
      ? [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "low",
            },
          },
        ]
      : [];

    const hasImage = imageBase64 && imageContent.length > 0;

    const requestBody: Record<string, unknown> = {
      model: openaiModel,
      messages: chatMessages.map((m) => {
        if (hasImage && m.role === "user") {
          return {
            role: m.role,
            content: [
              {
                type: "text",
                text: m.content,
              },
              ...imageContent,
            ],
          };
        }
        return m;
      }),
    };

const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("API error:", response.status, errorData);
      const errorText = await response.text().catch(() => "");
      console.error("Raw error response:", errorText);
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      return NextResponse.json({ error: "No response from model" }, { status: 500 });
    }

    let parsed: { bboxes?: BBox[]; text?: string } = {};
    try {
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return NextResponse.json({
        text: assistantMessage,
        bboxes: [],
      });
    }

    return NextResponse.json({
      text: parsed.text || assistantMessage,
      bboxes: parsed.bboxes || [],
    });
  } catch (error) {
    console.error("Chat completions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}