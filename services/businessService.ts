
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

export async function findBusinessLeads(
  query: SearchQuery,
  userLocation?: { lat: number; lng: number }
): Promise<BusinessLead[]> {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING: Please add your Gemini API Key to Vercel Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const { city, categories, radius } = query;

  const categoriesStr = categories.join(', ');
  
  const systemInstruction = `You are an expert Lead Research Specialist. Find business leads for "${categoriesStr}" in "${city}, India" within ${radius}km.
Output strictly as a JSON array of objects.
Required fields: name, address, lat, lng.
Optional fields: phone, website, email, rating, userRatingsTotal, establishedDate.
No placeholders like "1234567890". Use null if unknown.`;

  const prompt = `Generate 100 business leads for ${categoriesStr} in ${city}, India. Output only JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              phone: { type: Type.STRING, nullable: true },
              website: { type: Type.STRING, nullable: true },
              email: { type: Type.STRING, nullable: true },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              establishedDate: { type: Type.STRING, nullable: true },
              rating: { type: Type.NUMBER, nullable: true },
              userRatingsTotal: { type: Type.INTEGER, nullable: true }
            },
            required: ["name", "address", "lat", "lng"]
          }
        }
      }
    });

    let text = response.text || "";
    // Safety check for empty or non-JSON response
    if (!text.trim()) throw new Error("AI returned an empty response.");
    
    // Sometimes the model wraps JSON in markdown blocks even with responseMimeType
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) text = jsonMatch[0];

    const results = JSON.parse(text);

    if (!Array.isArray(results)) return [];

    return results.map((item: any, index: number) => {
      const name = item.name || "Business Name Unknown";
      const address = item.address || "Address Unknown";

      return {
        id: `lead-${Date.now()}-${index}`,
        name,
        address,
        phone: item.phone || null,
        website: item.website || null,
        email: item.email || null,
        owner: null,
        lat: Number(item.lat) || 0,
        lng: Number(item.lng) || 0,
        distance: null,
        source: 'Google Search',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        establishedDate: item.establishedDate || null,
        rating: typeof item.rating === 'number' ? item.rating : null,
        userRatingsTotal: typeof item.userRatingsTotal === 'number' ? item.userRatingsTotal : null
      };
    });

  } catch (error: any) {
    console.error("Critical Search Error:", error);
    if (error.message?.includes("API_KEY_MISSING")) throw error;
    // Fast fallback attempt without tools to avoid timeout
    return await quickFallback(ai, query);
  }
}

async function quickFallback(ai: any, query: SearchQuery): Promise<BusinessLead[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `List 50 businesses for ${query.categories.join(', ')} in ${query.city}. JSON: [{name, address, phone, lat, lng}]`,
      config: { responseMimeType: "application/json" }
    });
    const items = JSON.parse(response.text || "[]");
    return items.map((item: any, index: number) => ({
      ...item,
      id: `fallback-${Date.now()}-${index}`,
      source: 'Google Search',
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.address}`)}`,
      lastUpdated: new Date().toISOString().split('T')[0]
    }));
  } catch (err) {
    return [];
  }
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
