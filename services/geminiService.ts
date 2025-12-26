import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReadingExercise, WritingScenario, WritingFeedback } from "../types";
import { Logger } from "./logger";

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
// We assume this variable is pre-configured, valid, and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";

// --- Randomization Constants for Diversity ---
const TOPICS = [
  "Database Migration Issue",
  "CI/CD Pipeline Failure",
  "Frontend UI Glitch on Mobile",
  "API Latency Spike",
  "Third-party Integration Error",
  "New Feature Specification Draft",
  "Code Review Disagreement",
  "Urgent Security Patch",
  "Cloud Infrastructure Cost Alert",
  "Legacy Code Refactoring Proposal"
];

const TONES = [
  "Urgent and slightly panicked",
  "Formal and professional",
  "Casual and friendly",
  "Frustrated but polite",
  "Direct and concise"
];

const WRITING_SITUATIONS = [
  "Requesting an extension on a deadline",
  "Explaining a production bug to stakeholders",
  "Declining a meeting request due to workload",
  "Asking for clarification on vague requirements",
  "Proposing a new technology stack to the lead",
  "Onboarding a new team member",
  "Reporting a blocker in the daily standup"
];

// Helper to pick random element
const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// Helper to determine persona based on level
const getLevelContext = (level: number): string => {
  if (level <= 20) {
    return "Level: Beginner (Levels 1-20). The user can barely communicate. Use simple vocabulary, short sentences, and very clear context.";
  } else if (level <= 40) {
    return "Level: Intermediate (Levels 21-40). The user is a standard engineer. Use technical jargon (API, latency, PRs, CI/CD) freely.";
  } else {
    return "Level: Advanced (Levels 41-50). The user is a manager or lead. Use sophisticated language, idioms, and nuance.";
  }
};

const READING_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING, description: "Email subject line" },
    sender: { type: Type.STRING, description: "Name and role of the sender (e.g., 'Mike, Backend Lead')" },
    body: { type: Type.STRING, description: "The content of the technical email or slack message." },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER, description: "Zero-based index of the correct option" },
          explanation: { type: Type.STRING, description: "Why the answer is correct (in Japanese)" }
        },
        required: ["question", "options", "correctIndex", "explanation"]
      }
    }
  },
  required: ["subject", "sender", "body", "questions"]
};

export const generateReadingExercise = async (level: number): Promise<ReadingExercise> => {
  Logger.info(`Generating Reading Exercise for Level ${level}`);
  const levelContext = getLevelContext(level);
  const topic = getRandom(TOPICS);
  const tone = getRandom(TONES);

  const prompt = `Generate a reading comprehension exercise for a software engineer learning English.
  ${levelContext}
  
  Scenario Variables:
  - Topic: ${topic}
  - Tone: ${tone}
  
  Create a realistic email or message from a colleague based on the above variables.
  Include 3 multiple choice comprehension questions.
  IMPORTANT: The 'explanation' for each question must be in Japanese.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: READING_SCHEMA,
        systemInstruction: "You are a senior technical English tutor designed to simulate real-world software engineering communication."
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI model");
    }

    const data = JSON.parse(response.text) as ReadingExercise;
    Logger.info("Reading Exercise Generated Successfully", { subject: data.subject });
    return data;

  } catch (error) {
    Logger.error("Failed to generate reading exercise", error);
    throw error;
  }
};

const SCENARIO_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    context: { type: Type.STRING, description: "The situation (e.g., 'The production DB is spiking in CPU')" },
    recipientRole: { type: Type.STRING, description: "Who the user is writing to" },
    goal: { type: Type.STRING, description: "What the user needs to achieve (in Japanese)" },
    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Facts that must be included (in Japanese)" }
  },
  required: ["context", "recipientRole", "goal", "keyPoints"]
};

export const generateWritingScenario = async (level: number): Promise<WritingScenario> => {
  Logger.info(`Generating Writing Scenario for Level ${level}`);
  const levelContext = getLevelContext(level);
  const situation = getRandom(WRITING_SITUATIONS);
  const tone = getRandom(TONES);

  const prompt = `Generate a writing scenario for a software engineer.
  ${levelContext}
  
  Scenario Variables:
  - Situation: ${situation}
  - Desired Tone: ${tone}
  
  Format constraints:
  1. 'context' must be in English (simulate a received message or observed situation).
  2. 'goal' and 'keyPoints' MUST be in Japanese (instructions to the user).`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCENARIO_SCHEMA
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI model");
    }

    const data = JSON.parse(response.text) as WritingScenario;
    Logger.info("Writing Scenario Generated Successfully", { context: data.context });
    return data;

  } catch (error) {
    Logger.error("Failed to generate writing scenario", error);
    throw error;
  }
};

const FEEDBACK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "Score from 0 to 100 based on clarity, tone, and grammar." },
    critique: { type: Type.STRING, description: "Constructive feedback on the user's writing in Japanese." },
    improvedVersion: { type: Type.STRING, description: "A native-level rewrite of the user's message in English." },
    grammarMistakes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of specific grammar or vocabulary errors explained in Japanese." }
  },
  required: ["score", "critique", "improvedVersion", "grammarMistakes"]
};

export const evaluateWriting = async (level: number, scenario: WritingScenario, userDraft: string): Promise<WritingFeedback> => {
  Logger.info("Evaluating User Draft");
  const levelContext = getLevelContext(level);
  const prompt = `Evaluate this English writing submission from a software engineer.
  ${levelContext}
  
  Scenario Context: ${scenario.context}
  Goal (Japanese): ${scenario.goal}
  Recipient: ${scenario.recipientRole}
  
  User's Draft: "${userDraft}"
  
  Output Requirements:
  1. 'score': 0-100.
  2. 'improvedVersion': Natural English rewrite.
  3. 'critique': Provide constructive feedback in Japanese. ALWAYS include example sentences (例文) to illustrate your points.
  4. 'grammarMistakes': Explain errors in Japanese.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: FEEDBACK_SCHEMA
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI model");
    }

    const data = JSON.parse(response.text) as WritingFeedback;
    Logger.info("Evaluation Complete", { score: data.score });
    return data;

  } catch (error) {
    Logger.error("Failed to evaluate writing", error);
    throw error;
  }
};