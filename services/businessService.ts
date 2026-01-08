
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
  
  const systemInstruction = `You are a professional Lead Generation Specialist. Your goal is to find accurate business leads for "${categoriesStr}" in "${city}, India" within a ${radius}km radius.

CRITICAL INSTRUCTIONS:
1. PHONE NUMBERS ARE MANDATORY: Use your Google Search tool to find the ACTUAL official phone numbers for these businesses. A lead without a phone number is significantly less valuable.
2. SOURCE VERIFICATION: Check Google Maps profiles and official websites via search to extract real contact details.
3. NO FAKE DATA: Do not invent phone numbers. Do not use "1234567890" or "0000000000". If a number is truly unavailable after searching, use null.
4. FORMAT: Return a valid JSON array of objects.`;

  const prompt = `Find 100 real business leads for "${categoriesStr}" in "${city}". 
For each business, use Google Search to find their official phone number, address, and current rating. 
Prioritize businesses that have contact numbers listed on their Google Maps profile or website.`;

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
    if (!text.trim()) throw new Error("AI returned an empty response.");
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) text = jsonMatch[0];

    const results = JSON.parse(text);
    if (!Array.isArray(results)) return [];

    return results.map((item: any, index: number) => {
      const name = item.name || "Business Name Unknown";
      const address = item.address || "Address Unknown";
      
      // Strict phone cleaning
      let phone = item.phone ? String(item.phone).trim() : null;
      if (phone) {
        const pLower = phone.toLowerCase();
        const isInvalid = 
          pLower.includes('123456789') || 
          pLower.includes('00000000') || 
          pLower === 'null' || 
          pLower === 'na' || 
          pLower === 'n/a' || 
          pLower.length < 6;
        if (isInvalid) phone = null;
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
    console.error("Search Error:", error);
    if (error.message?.includes("API_KEY_MISSING")) throw error;
    return await quickFallback(ai, query);
  }
}

async function quickFallback(ai: any, query: SearchQuery): Promise<BusinessLead[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `List 30 businesses for ${query.categories.join(', ')} in ${query.city} with phone numbers. JSON: [{name, address, phone, lat, lng}]`,
      config: { responseMimeType: "application/json" }
    });
    const items = JSON.parse(response.text || "[]");
    return items.map((item: any, index: number) => ({
      ...item,
      id: `fb-${Date.now()}-${index}`,
      source: 'Google Search',
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.address}`)}`,
      lastUpdated: new Date().toISOString().split('T')[0],
      email: null,
      website: null,
      owner: null,
      distance: null,
      establishedDate: null,
      rating: null,
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
