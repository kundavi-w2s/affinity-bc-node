import { GoogleGenerativeAI } from '@google/generative-ai';
import { APP_CONSTANTS ,GEMINI_API_ERROR_CHECK} from '../../utils/constants';

export interface IAISuggestions {
  icebreaker: string;
  flirting: string;
  next_step: string;
}

export class AIService {
  private aiClient: GoogleGenerativeAI;
  private modelName: string;
  private availableModels = [
    GEMINI_API_ERROR_CHECK.gemini2_0,
    GEMINI_API_ERROR_CHECK.gemini2_5
  ];
  private currentModelIndex = 0;

  private datingSuggestionsSchema = {
    type: 'OBJECT',
    properties: {
      icebreaker: {
        type: 'STRING',
        description: 'A fresh, contextually relevant conversation starter (under 25 words).',
      },
      flirting: {
        type: 'STRING',
        description: 'A light, respectful, orientation-aware flirting suggestion (under 18 words).',
      },
      next_step: {
        type: 'STRING',
        description: 'A forward-moving prompt to deepen connection or propose a safe next step (under 18 words).',
      },
    },
    required: ['icebreaker', 'flirting', 'next_step'],
  };

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set');
    }
    
    const envModel = process.env.AI_MODEL_NAME;
    if (envModel && this.availableModels.includes(envModel)) {
      this.modelName = envModel;
      this.currentModelIndex = this.availableModels.indexOf(envModel);
    } else {
      this.modelName = this.availableModels[0]; 
    }

    this.aiClient = new GoogleGenerativeAI(apiKey || '');
  }

  private switchToNextModel(): void {
    this.currentModelIndex = (this.currentModelIndex + 1) % this.availableModels.length;
    this.modelName = this.availableModels[this.currentModelIndex];
    console.warn(`Switched to fallback model: ${this.modelName}`);
  }


  private createPrompt(
    chatHistory: Array<{ speaker: string; message: string }>,
    userInput: string,
    partnerProfile: string
  ): string {
    const systemInstruction = `
       You are 'Co-Pilot' — an expert, witty, empathetic, culturally aware, and safety-compliant
Dating & Relationship Chat messenger. 
Your job is to analyze:
1) The conversation history
2) The user's latest message
3) The other person's dating profile summary
4) Their sexual orientation and relationship intention (implicit or explicit)
Then generate exactly THREE high-quality messages for what the user should send next.

Your responses must ALWAYS:
- Return ONLY valid JSON following the exact schema.
- Match the natural tone, slang, and language style (e.g., Tanglish/Hinglish) of the chat.
- Respect sexual orientation (Straight, Gay, Lesbian, Bisexual) and never assume incorrectly.
- Respect relationship intention: Long-term, Short-term, Casual Dating, Friendship, or Not Sure.
- If the users conversations are in the harrasment or sexual abuse or bad words type, strictly neglect those and provide your output messages 'As an assistant for WingMAWO, I do not support or encourage such types of speech.
- Stay fully SAFE & COMPLIANT.

STRICT SAFETY & COMPLIANCE RULES:
- No sexual, explicit, NSFW, or suggestive content.
- No underage content — assume both participants are adults; never reference age unless already provided.
- No harassment, pressure, manipulation, or guilt messaging.
- No personal data: do NOT suggest sharing phone, WhatsApp, IG, Snap, location, workplace, etc.
- No meeting requests unless conversation already indicates comfort AND relationship intent supports it.
- Keep flirting subtle, respectful, and consent-aware.
- No discriminatory, offensive, or culturally insensitive content.
- No medical, legal, or psychological advice.
- Maintain emotional comfort and avoid overstepping boundaries.

    `;

    const requirements = `
      You MUST return exactly THREE Messages that map to the following keys in your JSON object:
1. **icebreaker** (string value): **(GUIDANCE PROMPT)**
   - **This output must be a message TO THE USER about what they can ask the match, based on the profile/history.**
   - It should be only a message the user sends directly.
   - Example: 'Hi! i hope you love street photography, do you ever got lost trying to find a shot?'
   - This MUST be a complete, ready-to-send message (under 18 words).
   - Helps revive or re-pivot the conversation naturally.

2. **flirting** (string value): **(GUIDANCE PROMPT)**
- **This output must be a message TO THE USER about what they can ask the match, based on the profile/history.**
- It should be only a message the user sends directly.
   - Light, respectful, orientation-aware flirting.
   - This MUST be a complete, ready-to-send message (under 18 words).
   - No explicit language. No physical comments unless partner initiated.

3. **next_step** (string value): **(GUIDANCE PROMPT)**
- **This output must be a message TO THE USER about what they can ask the match, based on the profile/history.**
- It should be only a message the user sends directly.
   - A forward-moving prompt that deepens connection.
   - This MUST be a complete, ready-to-send message (under 18 words).
   - Compliant: no sharing personal details; no rushing meetings.

GENERAL CONSTRAINTS:
- The 'flirting' and 'next_step' prompt messages must be under 18 words.
- The 'icebreaker' prompt messages can be slightly longer (under 25 words) to be useful.
- Do NOT repeat topics from conversation history.
- Blend naturally with the partner's profile summary.
- Output MUST follow this exact JSON structure (DO NOT WRAP IT IN A ROOT KEY LIKE 'suggestions'):
{icebreaker: ..., flirting: ..., next_step: ...}

    `;

    const historyText = chatHistory
      .map(msg => `[${msg.speaker}]: ${msg.message}`)
      .join('\n');

    return `
        ${systemInstruction}
        --- PARTNER PROFILE SUMMARY ---
        ${partnerProfile}
        
        --- CONVERSATION HISTORY ---
        ${historyText}
        
        --- USER'S CURRENT INPUT ---
        User is currently typing: '${userInput}'
        
        ${requirements}
    `;
  }

 
  async generateSuggestions(
    chatHistory: Array<{ speaker: string; message: string }>,
    userInput: string = '',
    partnerProfile: string = ''
  ): Promise<IAISuggestions | null> {
    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = this.availableModels.length;

    while (attempts < maxAttempts) {
      try {
        if (!process.env.GEMINI_API_KEY) {
          console.error(APP_CONSTANTS.error.gemini_key_err);
          return null;
        }

        const prompt = this.createPrompt(chatHistory, userInput, partnerProfile);

        const model = this.aiClient.getGenerativeModel({
          model: this.modelName,
        });

        const response = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: prompt,
            }],
          }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
            responseSchema: this.datingSuggestionsSchema as any,
          },
        });

        const responseText = response.response.text();
        const suggestionsData: IAISuggestions = JSON.parse(responseText);

        return suggestionsData;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || '';
        const errorStatus = error?.status;

        const isRetryableError =
          errorMessage.includes(GEMINI_API_ERROR_CHECK.RESOURCE_EXHAUSTED) ||
          errorMessage.includes(GEMINI_API_ERROR_CHECK.quota) ||
          errorMessage.includes(GEMINI_API_ERROR_CHECK.not_found) ||
          errorMessage.includes(APP_CONSTANTS.code.TOO_MANY_REQUESTS) ||
          errorMessage.includes(APP_CONSTANTS.code.SERVICE_UNAVAILABLE) ||
          errorMessage.includes(GEMINI_API_ERROR_CHECK.service) ||
          errorMessage.includes(GEMINI_API_ERROR_CHECK.overloaded) ||
          errorStatus === APP_CONSTANTS.code.TOO_MANY_REQUESTS ||
          errorStatus === APP_CONSTANTS.code.SERVICE_UNAVAILABLE;

        const retryMessage = `${APP_CONSTANTS.error.ai_suggestion} - Model "${this.modelName}" (${errorStatus})`;

        if (isRetryableError) {
          console.warn(`${retryMessage}: ${errorMessage.substring(0, 100)}`);
          attempts++;

          if (attempts < maxAttempts) {
            this.switchToNextModel();
            continue; 
          }
        }

        console.error(APP_CONSTANTS.error.gemini_service_Err, error);
        return null;
      }
    }

    console.error(
      `${APP_CONSTANTS.message.ai_chat_error} - All models exhausted after ${maxAttempts} attempts.`,
      lastError?.message
    );
    return null;
  }

  
  validateChatHistory(
    chatHistory: Array<{ speaker: string; message: string }>
  ): { valid: boolean; error?: string } {
    if (!Array.isArray(chatHistory)) {
      return { valid: false, error: APP_CONSTANTS.message.chat_history};
    }

    for (const entry of chatHistory) {
      if (!entry.speaker || !entry.message) {
        return { valid: false, error: APP_CONSTANTS.message.chat_sugg };
      }
    }

    return { valid: true };
  }
}