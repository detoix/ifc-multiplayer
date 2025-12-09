import { NextRequest, NextResponse } from "next/server";

const MODEL_NAME = "gemini-3-pro-image-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

export async function POST(request: NextRequest) {
  try {
    const { imageData, prompt } = (await request.json()) as {
      imageData?: string;
      prompt?: string;
    };

    if (!imageData || typeof imageData !== "string") {
      return NextResponse.json(
        { error: "Missing required field `imageData`." },
        { status: 400 }
      );
    }

    console.log("[nano-banana] Incoming request");

    const apiKey =
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    if (!apiKey) {
      console.error(
        "[nano-banana] Missing Google Generative AI API key environment variable."
      );
      return NextResponse.json(
        { error: "Server is not configured with a Google Generative AI API key." },
        { status: 500 }
      );
    }

    const commaIndex = imageData.indexOf(",");
    const base64Data =
      commaIndex >= 0 ? imageData.slice(commaIndex + 1) : imageData;

    const mimeMatch = imageData.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch?.[1] || "image/png";

    const effectivePrompt =
      prompt ||
      "Enhance this architectural 3D scene into a high-quality, photorealistic render from the exact same camera angle. Keep all building geometry, shapes, and layout strictly unchanged—do not move, remove, or add any objects, and do not alter the composition or perspective. Add serene, natural surroundings (sky, soft landscaping, trees, and ground) that fit the existing site without changing the building footprint. Enrich and balance the colors, improve materials, and add realistic global illumination, soft shadows, reflections, and small details so the building looks more realistic and premium, while preserving the original structure exactly.";

    const requestBody = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: effectivePrompt,
            },
          ],
        },
      ],
    };

    console.log("[nano-banana] Gemini request payload summary", {
      model: MODEL_NAME,
      mimeType,
      prompt: effectivePrompt,
      imageBytes: base64Data.length,
      imagePreview: base64Data.slice(0, 64),
    });

    const apiUrl = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text().catch(() => "");
      console.error(
        "[nano-banana] Gemini HTTP error",
        geminiResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: "Gemini HTTP error", status: geminiResponse.status },
        { status: 502 }
      );
    }

    const json = (await geminiResponse.json()) as any;
    const candidates: any[] = json?.candidates ?? [];
    const parts: any[] = candidates[0]?.content?.parts ?? [];

    const imagePart = parts.find(
      (part) => part.inlineData && part.inlineData.data
    );

    if (!imagePart) {
      console.error("[nano-banana] No inlineData image returned", json);
      return NextResponse.json(
        { error: "Gemini did not return an image." },
        { status: 502 }
      );
    }

    const outMimeType = imagePart.inlineData.mimeType || "image/png";
    const outBase64: string = imagePart.inlineData.data;
    const dataUri = `data:${outMimeType};base64,${outBase64}`;

    return NextResponse.json({ imageUrl: dataUri });
  } catch (error) {
    console.error("[nano-banana] Failed to generate image with Gemini", error);
    return NextResponse.json(
      { error: "Failed to generate image with Gemini." },
      { status: 500 }
    );
  }
}
