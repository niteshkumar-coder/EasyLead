
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

export async function findBusinessLeads(
  query: SearchQuery,
  userLocation?: { lat: number; lng: number }
): Promise<BusinessLead[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { city, categories, radius } = query;

  const categoriesStr = categories.join(', ');
  
  const systemInstruction = `You are an expert Lead Research Specialist. Your task is to find exactly 100 REAL business leads for "${categoriesStr}" in or around "${city}, India" within a ${radius}km radius.

CRITICAL DATA ACCURACY RULES:
1. PHONE NUMBERS: You MUST use the googleSearch tool to locate the official Google Maps (Business Profile) for each business. Extract the official "formatted_phone_number". This is your highest priority.
2. GROUNDING: If a phone number is listed on their Google Maps profile, you MUST include it. Only return null if the business profile explicitly lacks any contact number.
3. NO PLACEHOLDERS: Do not use "1234567890", "0000000000", or "Not Available" as strings. Return null if no number is found.
4. COORDINATES: Ensure 'lat' and 'lng' are accurate for distance calculations.
5. RATINGS: Include 'rating' and 'userRatingsTotal' from the Google Maps data.

The output MUST be a valid JSON array of 100 objects.`;

  const prompt = `Find 100 detailed business leads for "${categoriesStr}" located within a ${radius}km radius of "${city}, India". 
For every business, search for their Google Maps profile to extract the official contact phone number, address, and ratings.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        // High thinking budget to ensure the model carefully parses search results for phone numbers.
        thinkingConfig: { thinkingBudget: 4000 }, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              phone: { 
                type: Type.STRING, 
                nullable: true, 
                description: "The official formatted contact number from Google Maps. Use null if not listed." 
              },
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

    if (!Array.isArray(results)) {
      throw new Error("Result is not an array");
    }

    return results.map((item: any, index: number) => {
      // Clean phone numbers to ensure they are either a real number or null
      let phone = item.phone;
      if (typeof phone === 'string') {
        const p = phone.trim().toLowerCase();
        
        const isPlaceholder = 
          !p || 
          p === 'null' || 
          p === 'na' || 
          p === 'n/a' || 
          p === 'none' || 
          p === 'undefined' || 
          p === 'not found' ||
          p === 'missing' ||
          p.includes('not available') || 
          p.includes('000000') || 
          p.includes('1234567890');
          
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

  } catch (error) {
    console.error("Search failed, using fallback:", error);
    return await quickFallback(ai, query);
  }
}

async function quickFallback(ai: any, query: SearchQuery): Promise<BusinessLead[]> {
  const categoriesStr = query.categories.join(', ');
  const fallbackPrompt = `List 100 businesses in "${query.city}" for ${categoriesStr} within a ${query.radius}km radius. Prioritize phone numbers from Google Maps. Return JSON array.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: fallbackPrompt,
      config: { 
        responseMimeType: "application/json"
      }
    });
    const items = JSON.parse(response.text.trim());
    return items.map((item: any, index: number) => {
      let phone = item.phone;
      if (typeof phone === 'string') {
        const p = phone.trim().toLowerCase();
        if (!p || p === 'null' || p === 'na' || p === 'n/a' || p === 'none') phone = null;
      } else {
        phone = null;
      }
      return {
        ...item,
        id: `fb-${Date.now()}-${index}`,
        phone,
        source: 'Google Search',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.address}`)}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        establishedDate: item.establishedDate || null,
        rating: item.rating || null,
        userRatingsTotal: item.userRatingsTotal || null
      };
    });
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
