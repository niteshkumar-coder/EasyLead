
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
  
  const systemInstruction = `You are a professional Lead Generation Specialist for the Indian market. Your task is to find exactly 100 business leads for "${categoriesStr}" in "${city}, India" within ${radius}km.

CRITICAL DATA EXTRACTION RULES:
1. PHONE NUMBERS: You MUST use the Google Search tool to extract the "formatted_phone_number" directly from the business's Google Maps profile (GMB).
2. ACCURACY: If a mobile number is visible on their Google profile, you MUST include it in the 'phone' field. If it is absolutely not found after searching, use null.
3. NO FAKE DATA: Never return placeholders like "1234567890", "0000000000", or repeating digits.
4. QUANTITY: Find exactly 100 leads.
5. FORMAT: Return a valid JSON array of objects.`;

  const prompt = `Perform a deep search for 100 businesses in ${city} belonging to these categories: ${categoriesStr}. 
For every business, check their Google Maps profile to get their specific "formatted_phone_number", current rating, and full address. 
Output the results as a JSON array.`;

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
              phone: { 
                type: Type.STRING, 
                nullable: true, 
                description: "The formatted_phone_number from the Google Maps profile."
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

    let text = response.text || "";
    if (!text.trim()) throw new Error("AI returned an empty response.");
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) text = jsonMatch[0];

    const results = JSON.parse(text);
    if (!Array.isArray(results)) return [];

    return results.map((item: any, index: number) => {
      const name = item.name || "Business Name Unknown";
      const address = item.address || "Address Unknown";
      
      // Rigorous phone validation
      let phone = item.phone ? String(item.phone).trim() : null;
      if (phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        const pLower = phone.toLowerCase();
        
        const isPlaceholder = 
          digits.length < 7 || 
          /^(.)\1+$/.test(digits) || 
          digits === '1234567890' ||
          pLower.includes('null') || 
          pLower.includes('not found') ||
          pLower.includes('hidden');

        if (isPlaceholder) phone = null;
      }

      return {
        id: `lead-${Date.now()}-${index}`,
        name,
        address,
        phone,
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
    console.error("Primary Search Failed:", error);
    if (error.message?.includes("API_KEY_MISSING")) throw error;
    return await quickFallback(ai, query);
  }
}

async function quickFallback(ai: any, query: SearchQuery): Promise<BusinessLead[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `List exactly 100 businesses for ${query.categories.join(', ')} in ${query.city} with real formatted phone numbers. Output ONLY a JSON array: [{name, address, phone, lat, lng, rating}]`,
      config: { responseMimeType: "application/json" }
    });
    const items = JSON.parse(response.text || "[]");
    return items.map((item: any, index: number) => ({
      ...item,
      id: `fallback-${Date.now()}-${index}`,
      source: 'Google Search',
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.address}`)}`,
      lastUpdated: new Date().toISOString().split('T')[0],
      phone: item.phone && !item.phone.includes('12345') ? item.phone : null,
      email: null,
      website: null,
      owner: null,
      distance: null,
      establishedDate: null,
      rating: typeof item.rating === 'number' ? item.rating : null,
      userRatingsTotal: null
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
