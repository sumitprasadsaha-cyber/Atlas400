import { GoogleGenAI } from "@google/genai";

export interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}

export interface GenerateTextResult {
  text: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
  model: string;
}

export interface GenerateStructuredParams<T = any> {
  prompt: string;
  systemInstruction?: string;
  schema?: any;
  temperature?: number;
  model?: string;
}

export interface ModerationResult {
  flagged: boolean;
  categories: {
    hate: boolean;
    harassment: boolean;
    sexual: boolean;
    violence: boolean;
    promptInjection: boolean;
    spam: boolean;
  };
  reason?: string;
}

/**
 * Universal AI Provider Interface.
 * Allows swapping Gemini, OpenAI, Anthropic Claude, Azure OpenAI, or Local LLMs
 * without rewriting business logic.
 */
export interface AIProvider {
  readonly name: string;
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateStructured<T>(params: GenerateStructuredParams<T>): Promise<{ data: T; tokenUsage?: GenerateTextResult["tokenUsage"]; latencyMs?: number; model: string }>;
  moderateContent(text: string): Promise<ModerationResult>;
}

/**
 * Google Gemini Provider Implementation using @google/genai SDK
 */
export class GeminiProvider implements AIProvider {
  public readonly name = "google-gemini";
  private defaultModel: string;
  private client: GoogleGenAI | null = null;

  constructor(defaultModel = "gemini-3.7-flash") {
    this.defaultModel = defaultModel;
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is missing.");
      }
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return this.client;
  }

  public async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const startTime = Date.now();
    const ai = this.getClient();
    const model = params.model || this.defaultModel;

    const response = await ai.models.generateContent({
      model,
      contents: params.prompt,
      config: {
        systemInstruction: params.systemInstruction,
        temperature: params.temperature ?? 0.3,
        maxOutputTokens: params.maxOutputTokens,
      },
    });

    const latencyMs = Date.now() - startTime;
    const text = response.text || "";

    const usage = response.usageMetadata;
    const tokenUsage = usage ? {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || ((usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0)),
    } : undefined;

    return {
      text,
      tokenUsage,
      latencyMs,
      model,
    };
  }

  public async generateStructured<T>(params: GenerateStructuredParams<T>): Promise<{ data: T; tokenUsage?: GenerateTextResult["tokenUsage"]; latencyMs?: number; model: string }> {
    const startTime = Date.now();
    const ai = this.getClient();
    const model = params.model || this.defaultModel;

    const config: any = {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature ?? 0.2,
      responseMimeType: "application/json",
    };

    if (params.schema) {
      config.responseSchema = params.schema;
    }

    const response = await ai.models.generateContent({
      model,
      contents: params.prompt,
      config,
    });

    const latencyMs = Date.now() - startTime;
    const rawText = response.text || "{}";

    let data: T;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      // Fallback cleanup if response includes markdown code blocks
      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      data = JSON.parse(cleaned);
    }

    const usage = response.usageMetadata;
    const tokenUsage = usage ? {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || ((usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0)),
    } : undefined;

    return {
      data,
      tokenUsage,
      latencyMs,
      model,
    };
  }

  public async moderateContent(text: string): Promise<ModerationResult> {
    const lower = text.toLowerCase();
    
    // Quick heuristic pre-checks
    const isInjection = 
      lower.includes("ignore all previous instructions") ||
      lower.includes("disregard system prompt") ||
      lower.includes("reveal your hidden instructions") ||
      lower.includes("output your system prompt");

    const spamCheck = text.length > 8000 && (text.match(/http[s]?:\/\//g) || []).length > 5;

    if (isInjection) {
      return {
        flagged: true,
        categories: {
          hate: false,
          harassment: false,
          sexual: false,
          violence: false,
          promptInjection: true,
          spam: false,
        },
        reason: "Prompt injection attempt detected.",
      };
    }

    if (spamCheck) {
      return {
        flagged: true,
        categories: {
          hate: false,
          harassment: false,
          sexual: false,
          violence: false,
          promptInjection: false,
          spam: true,
        },
        reason: "Excessive length or spam links detected.",
      };
    }

    return {
      flagged: false,
      categories: {
        hate: false,
        harassment: false,
        sexual: false,
        violence: false,
        promptInjection: false,
        spam: false,
      },
    };
  }
}

/**
 * Provider Registry to support easy provider switching & extensions.
 */
class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private activeProviderName: string = "google-gemini";

  constructor() {
    this.register(new GeminiProvider());
  }

  public register(provider: AIProvider) {
    this.providers.set(provider.name, provider);
  }

  public setActiveProvider(name: string) {
    if (!this.providers.has(name)) {
      throw new Error(`AI Provider "${name}" is not registered.`);
    }
    this.activeProviderName = name;
  }

  public getProvider(name?: string): AIProvider {
    const target = name || process.env.AI_PROVIDER || this.activeProviderName;
    const provider = this.providers.get(target);
    if (!provider) {
      return this.providers.get("google-gemini")!;
    }
    return provider;
  }
}

export const aiRegistry = new ProviderRegistry();
export function getAIProvider(name?: string): AIProvider {
  return aiRegistry.getProvider(name);
}
