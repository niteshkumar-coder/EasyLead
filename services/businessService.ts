
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

export async function findBusinessLeads(
  query: SearchQuery,
  userLocation?: { lat: number; lng: number }
): Promise<BusinessLead[]> {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING: Please add your Gemini API Key to Vercel Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const { city, categories, radius } = query;

  const categoriesStr = categories.join(', ');
  
  const systemInstruction = `You are an expert Lead Research Specialist. Your task is to find exactly 100 REAL business leads for "${categoriesStr}" in or around "${city}, India" within a ${radius}km radius.

CRITICAL DATA ACCURACY RULES:
1. PHONE NUMBERS: Use googleSearch to find official contact details. 
2. NO PLACEHOLDERS: If no phone is found, return null. Do not use fake numbers like 1234567890.
3. OUTPUT: Valid JSON array of 100 objects.`;

  const prompt = `Find 100 business leads for "${categoriesStr}" in "${city}, India" (${radius}km radius). Include official phone numbers, addresses, and Google Maps ratings.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Flash is much faster and prevents Vercel Timeouts
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        // Reduced thinking budget to stay within Vercel's 10s limit
        thinkingConfig: { thinkingBudget: 2000 }, 
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

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const results = JSON.parse(text.trim());

    return results.map((item: any, index: number) => {
      let phone = item.phone;
      if (typeof phone === 'string') {
        const p = phone.trim().toLowerCase();
        const isPlaceholder = !p || p === 'null' || p === 'na' || p.includes('1234567890') || p.includes('000000');
        phone = isPlaceholder ? null : phone.trim();
      } else {
        phone = null;
      }

      const name = item.name || "Unknown Business";
      const address = item.address || "Address unavailable";

      return {
        id: `lead-${Date.now()}-${index}`,
        name,
        address,
        phone,
        website: item.website || null,
        email: item.email || null,
        owner: null,
        lat: typeof item.lat === 'number' ? item.lat : 0,
        lng: typeof item.lng === 'number' ? item.lng : 0,
        distance: null,
        source: 'Google Search',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        establishedDate: item.establishedDate || null,
        rating: item.rating || null,
        userRatingsTotal: item.userRatingsTotal || null
      };
    });

  } catch (error: any) {
    console.error("Search Error:", error);
    if (error.message?.includes("API_KEY_MISSING")) throw error;
    return await quickFallback(ai, query);
  }
}

async function quickFallback(ai: any, query: SearchQuery): Promise<BusinessLead[]> {
  const categoriesStr = query.categories.join(', ');
  const fallbackPrompt = `List 100 businesses in "${query.city}" for ${categoriesStr}. Return JSON array with fields: name, address, phone, lat, lng.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: fallbackPrompt,
      config: { responseMimeType: "application/json" }
    });
    const items = JSON.parse(response.text.trim());
    return items.map((item: any, index: number) => ({
      ...item,
      id: `fb-${Date.now()}-${index}`,
      source: 'Google Search',
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.address}`)}`,
      lastUpdated: new Date().toISOString().split('T')[0]
    }));
  } catch (err) {
    return [];
  }
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
