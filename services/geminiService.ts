import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SearchResult, Chapter } from "../types";

// Helper to decode Base64 audio
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext
): Promise<AudioBuffer> => {
  // Use byteOffset and byteLength to ensure correct view if data is a subarray (though decode returns new Uint8Array)
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  // Gemini 2.5 Flash TTS typically returns 24kHz mono
  const sampleRate = 24000;
  const numChannels = 1;
  
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};

export const searchContentWithGemini = async (query: string, type: 'book' | 'video'): Promise<SearchResult[]> => {
  if (!process.env.API_KEY) throw new Error("API Key faltante");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let prompt = "";

  if (type === 'video') {
    prompt = `Actúa como un Servidor de Datos de Warhammer 40k.
    Busca VIDEOS DE YOUTUBE, priorizando especificamente el canal "DAMPA" (https://www.youtube.com/@osodampa/playlists) y sus listas de reproducción.
    
    Instrucciones:
    1. La fuente principal de verdad debe ser el canal DAMPA.
    2. Si no hay resultados exactos ahí, busca en "La Voz de Horus" o "Todo Estrategia".
    3. Tema de búsqueda: "${query}".
    
    Usa Google Search para encontrar los títulos exactos.
    Devuelve SOLAMENTE un array JSON válido. Si no encuentras nada, devuelve una lista vacía [].
    NO incluyas texto conversacional como "Aquí tienes los resultados" o "No he encontrado nada". Solo JSON puro.
    
    Estructura JSON: [{"title": "Título Exacto del Video", "author": "Nombre del Canal", "description": "Breve resumen del contenido", "originalLanguage": "es", "mediaType": "video"}]
    `;
  } else {
    prompt = `Actúa como un bibliotecario experto de Warhammer 40k (Cogitator).
    Busca libros, novelas o relatos cortos que coincidan con: "${query}".
    
    Usa Google Search para validar títulos reales, buscar discusiones en Reddit, PDF Drives públicos o Wikis.
    Devuelve SOLAMENTE un array JSON válido. Si no encuentras nada, devuelve una lista vacía [].
    NO incluyas texto conversacional. Solo JSON puro.
    Traduce SIEMPRE título y descripción al ESPAÑOL.
    
    Estructura JSON: [{"title": "...", "author": "...", "description": "...", "originalLanguage": "...", "mediaType": "book"}]
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    if (response.text) {
      let cleanText = response.text.trim();
      
      // Remove markdown code blocks
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

      // Robust extraction: Find the first '[' and last ']'
      const start = cleanText.indexOf('[');
      const end = cleanText.lastIndexOf(']');

      if (start !== -1 && end !== -1 && end > start) {
        cleanText = cleanText.substring(start, end + 1);
        try {
            return JSON.parse(cleanText) as SearchResult[];
        } catch (e) {
            console.error("Error parseando el JSON extraído:", e, cleanText);
            return [];
        }
      } else {
        console.warn("No se encontró un array JSON en la respuesta:", cleanText);
        // Si el modelo responde "No he encontrado nada...", devolvemos array vacío en lugar de explotar
        return [];
      }
    }
    return [];
  } catch (error) {
    console.error("Error en búsqueda:", error);
    return [];
  }
};

export const generateContentStructure = async (title: string, author: string, type: 'book' | 'video'): Promise<Chapter[]> => {
  if (!process.env.API_KEY) throw new Error("API Key faltante");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let prompt = "";

  if (type === 'video') {
    prompt = `Genera una TRANSCRIPCIÓN DETALLADA (GUIÓN) del video "${title}" del canal "${author}".
    
    FUENTE Y ESTILO:
    Utiliza como referencia el estilo narrativo épico y dramático del canal DAMPA (https://www.youtube.com/@osodampa/playlists).
    
    INSTRUCCIONES DE TRANSCRIPCIÓN SIMULADA:
    1. El contenido debe ser 100% en ESPAÑOL.
    2. Imagina que estás transcribiendo el audio del video real.
    3. No hagas resúmenes cortos; genera el guión completo de la narración (aprox 1500-2000 palabras si el tema es complejo).
    4. Divide el guión en secciones lógicas.
    
    Estructura JSON deseada:
    [
      { "title": "Intro / Contexto", "content": "..." },
      { "title": "Narración Principal", "content": "..." },
      { "title": "Análisis y Conclusión", "content": "..." }
    ]
    `;
  } else {
    prompt = `Realiza una reconstrucción digital COMPLETA Y DETALLADA del libro "${title}" de ${author}.
    
    IMPORTANTE:
    1. El contenido debe ser 100% en ESPAÑOL.
    2. Genera una estructura de capitulos (Mínimo 3 capítulos largos).
    3. Basate en la información disponible en la red (wikis, fragmentos, reddit) para reconstruir la trama fielmente.
    
    Estructura JSON deseada:
    [
      { "title": "Prólogo", "content": "..." },
      { "title": "Capítulo 1", "content": "..." },
      { "title": "Capítulo 2", "content": "..." }
    ]
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ["title", "content"]
          }
        }
      }
    });

    if (response.text) {
        try {
            const chapters = JSON.parse(response.text) as Chapter[];
            return chapters;
        } catch (e) {
             console.error("Error parseando contenido generado:", e);
             throw new Error("Formato inválido en la respuesta generada");
        }
    }
    throw new Error("Respuesta vacía del servidor");
  } catch (error) {
    console.error("Error generando contenido:", error);
    return [{ title: "Error de Datos", content: "No se pudo recuperar el registro de la Noosphere. Intente nuevamente." }];
  }
};

export const generateSpeechFromText = async (text: string): Promise<AudioBuffer | null> => {
  if (!process.env.API_KEY) return null;

  // Reduced chunk size slightly to avoid payload errors
  const safeText = text.substring(0, 600); 

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: safeText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext
      );
      return audioBuffer;
    }
    return null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};