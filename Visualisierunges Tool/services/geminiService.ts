import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Edits an image using Gemini 2.5 Flash Image (Nano Banana).
 * 
 * @param base64Image The base64 encoded image string (without data:image/... prefix preferred, but handled if present)
 * @param prompt The text instruction for editing
 * @returns The base64 data URL of the generated image
 */
export const editBimImage = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    // Clean base64 string if it contains headers
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/png',
            },
          },
          {
            // Explicit instruction for photorealism and structure retention
            text: `Create a high-quality, photorealistic visualization of this 3D BIM model view. Maintain the exact camera angle, perspective, and building structure. ${prompt}`,
          },
        ],
      },
    });

    // Check for image in parts
    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};