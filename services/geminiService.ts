import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReadingExercise, WritingScenario, WritingFeedback } from "../types";
import { Logger } from "./logger";

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
// We assume this variable is pre-configured, valid, and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";

// --- Randomization Constants for Diversity (Expanded) ---
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
  "Legacy Code Refactoring Proposal",
  "Memory Leak Investigation",
  "Kubernetes Cluster Misconfiguration",
  "OAuth2 Authentication Failure",
  "Redis Cache Inconsistency",
  "Mobile App Crash on Launch",
  "Data Privacy Compliance Audit",
  "Microservices Communication Timeout",
  "Production Environment SSL Expiry",
  "Git Merge Conflict Resolution",
  "Sprint Planning Prioritization"
];

const TONES = [
  "Urgent and slightly panicked",
  "Formal and professional",
  "Casual and friendly",
  "Frustrated but polite",
  "Direct and concise",
  "Apologetic and humble",
  "Encouraging and supportive",
  "Technical and detailed",
  "Confused and seeking clarification",
  "Cautious and hesitant"
];

const WRITING_SITUATIONS = [
  "Requesting an extension on a deadline",
  "Explaining a production bug to stakeholders",
  "Declining a meeting request due to workload",
  "Asking for clarification on vague requirements",
  "Proposing a new technology stack to the lead",
  "Onboarding a new team member",
  "Reporting a blocker in the daily standup",
  "Negotiating a release date with the Product Manager",
  "Giving constructive feedback on a peer's code",
  "Announcing a breaking change to API consumers",
  "Requesting budget for a new SaaS tool",
  "Explaining a technical debt payoff plan",
  "Apologizing for a downtime incident",
  "Asking for help with a complex debugging issue"
];

// --- Few-Shot Examples ---

const READING_FEW_SHOT = \`
出力例:
{
  "subject": "Urgent: Production DB CPU Spike",
  "sender": "Sarah, DevOps Lead",
  "body": "Hi Team, I noticed the primary database CPU usage hit 95% at 2:00 AM UTC. It seems related to the new batch job. I've temporarily disabled the job. Can someone from the backend team investigate the query performance? We need a fix before tonight's peak traffic.",
  "questions": [
    {
      "question": "What is the main problem reported?",
      "options": ["The database is down", "High CPU usage on the database", "The batch job failed", "Network latency is high"],
      "correctIndex": 1,
      "explanation": "メールの冒頭で 'primary database CPU usage hit 95%' と述べられています。"
    },
    {
      "question": "What action did Sarah take?",
      "options": ["She fixed the query", "She scaled up the database", "She disabled the batch job", "She called the backend team"],
      "correctIndex": 2,
      "explanation": "'I've temporarily disabled the job' と書かれています。"
    },
    {
      "question": "What is required from the backend team?",
      "options": ["Restart the server", "Investigate query performance", "Write a new batch job", "Monitor the traffic"],
      "correctIndex": 1,
      "explanation": "'Can someone from the backend team investigate the query performance?' と依頼されています。"
    }
  ]
}
\`;

const WRITING_SCENARIO_FEW_SHOT = \`
出力例:
{
  "context": "You received a Slack message from the QA team: 'The login button on the staging environment is not working on Safari.'",
  "recipientRole": "QA Engineer (Alex)",
  "goal": "バグの再現手順を尋ね、調査することを伝える",
  "keyPoints": ["Safariのバージョンを確認する", "コンソールエラーがあるか聞く", "今から調査を開始することを伝える"]
}
\`;

const EVALUATION_FEW_SHOT = \`
入力例 (ユーザーのドラフト): "Hey Alex. I fix it. Wait please."
出力例:
{
  "score": 30,
  "critique": "文法は間違っていませんが、ビジネスの場としてはあまりにもカジュアルすぎますし、情報が不足しています。「I fix it」ではなく「I will investigate it」などが適切です。",
  "improvedVersion": "Hi Alex, thanks for the report. I'll look into it right away. Could you please wait a moment while I investigate?",
  "grammarMistakes": ["'I fix it' は現在形ですが、これから行う動作なので 'I will fix it' または 'I am fixing it' が適切です。", "全体的に単語が不足しており、ぶっきらぼうな印象を与えます。"]
}
\`;

// Helper to pick random element
const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// Helper to determine persona based on level
const getLevelContext = (level: number): string => {
  if (level <= 20) {
    return "レベル: 初級 (Level 1-20)。ユーザーはほとんどコミュニケーションが取れません。シンプルな語彙、短い文章、非常に明確な文脈を使用してください。";
  } else if (level <= 40) {
    return "レベル: 中級 (Level 21-40)。ユーザーは標準的なエンジニアです。専門用語（API, Latency, PR, CI/CDなど）を自由に使用してください。";
  } else {
    return "レベル: 上級 (Level 41-50)。ユーザーはマネージャーまたはリードです。洗練された言語、イディオム、ニュアンスを使用してください。";
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

  const prompt = \`ソフトウェアエンジニアが英語を学ぶための読解問題を作成してください。
  \${levelContext}
  
  シナリオ変数:
  - トピック: \${topic}
  - トーン: \${tone}
  
  上記の変数に基づいて、同僚からのリアルなメールやメッセージを作成してください。
  3つの多肢選択式の読解問題を含めてください。
  重要: 各質問の 'explanation'（解説）は日本語で記述してください。

  ${READING_FEW_SHOT}`;

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

  const prompt = \`ソフトウェアエンジニア向けのライティングシナリオを作成してください。
  \${levelContext}
  
  シナリオ変数:
  - シチュエーション: \${situation}
  - 希望するトーン: \${tone}
  
  フォーマット制約:
  1. 'context' は英語で記述してください（受信したメッセージや状況をシミュレート）。
  2. 'goal' と 'keyPoints' は日本語で記述してください（ユーザーへの指示）。
  
  ${WRITING_SCENARIO_FEW_SHOT}`;

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
  const prompt = \`ソフトウェアエンジニアによる英語の書き込みを評価してください。
  \${levelContext}
  
  シナリオの背景: \${scenario.context}
  ゴール (日本語): \${scenario.goal}
  受信者: \${scenario.recipientRole}
  
  ユーザーのドラフト: "\${userDraft}"
  
  出力要件:
  1. 'score': 0-100点。
  2. 'improvedVersion': 自然な英語への書き直し。
  3. 'critique': 日本語で建設的なフィードバックを提供してください。ポイントを説明するために必ず例文を含めてください。
  4. 'grammarMistakes': エラーを日本語で説明してください。
  
  ${EVALUATION_FEW_SHOT}`;

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