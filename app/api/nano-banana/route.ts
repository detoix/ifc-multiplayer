import { NextRequest, NextResponse } from "next/server";

const MODEL_NAME = "gemini-3-pro-image-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

// Very simple in-memory, per-IP render counter.
// This resets whenever the server restarts and is only
// meant as a basic safety valve, not a strong quota system.
const MAX_RENDERS_PER_IP = 10;
const ipUsage = new Map<string, number>();

function getClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  // Fallback: this will group all "unknown" users together,
  // but that's acceptable for a very basic limiter.
  return "unknown";
}

export async function GET(request: NextRequest) {
  const key = getClientKey(request);
  const used = ipUsage.get(key) ?? 0;
  const remaining = Math.max(0, MAX_RENDERS_PER_IP - used);

  return NextResponse.json({
    limit: MAX_RENDERS_PER_IP,
    used,
    remaining,
  });
}

export async function POST(request: NextRequest) {
  try {
    const key = getClientKey(request);
    const usedSoFar = ipUsage.get(key) ?? 0;
    const remainingBefore = Math.max(0, MAX_RENDERS_PER_IP - usedSoFar);

    if (remainingBefore <= 0) {
      console.warn("[nano-banana] Render limit reached for key", key);
      return NextResponse.json(
        {
          error:
            "Render limit reached for this browser. Please come back later or restart the server.",
          limit: MAX_RENDERS_PER_IP,
          used: usedSoFar,
          remaining: 0,
        },
        { status: 429 }
      );
    }

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

    const newUsed = usedSoFar + 1;
    ipUsage.set(key, newUsed);
    const remainingAfter = Math.max(0, MAX_RENDERS_PER_IP - newUsed);

    return NextResponse.json({
      imageUrl: dataUri,
      limit: MAX_RENDERS_PER_IP,
      used: newUsed,
      remaining: remainingAfter,
    });
  } catch (error) {
    console.error("[nano-banana] Failed to generate image with Gemini", error);
    return NextResponse.json(
      { error: "Failed to generate image with Gemini." },
      { status: 500 }
    );
  }
}
