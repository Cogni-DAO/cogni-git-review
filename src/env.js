// src/env.js - Single source of truth for all environment variables
import "dotenv/config";
import { z } from "zod";

// Helper for optional URLs
const urlOrUndef = (schema = z.string().url()) => z.preprocess(
  v => (v === "" ? undefined : v), 
  schema.optional()
);

const base = z.object({
  NODE_ENV: z.enum(["development","test","production"]).default("development"),
  APP_ENV: z.enum(["dev","preview","prod"]).default("dev"),
});

const logging = z.object({
  LOG_LEVEL: z.enum(["trace","debug","info","warn","error","fatal"]).default("info"),
});

const service = z.object({
  PORT: z.coerce.number().default(3000),
});

const loki = z.object({
  LOKI_URL: urlOrUndef(),
  LOKI_USER: z.string().optional(),
  LOKI_TOKEN: z.string().optional(),
});

// Check if we're in development/test mode (for CI/testing environments)
// In development/test, make required fields optional to allow linting without production secrets
// This prevents CI failures when ESLint imports trigger environment validation
const isDevelopmentMode = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test");

const ai = z.object({
  OPENAI_API_KEY: isDevelopmentMode ? z.string().optional() : z.string().min(1),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: urlOrUndef(),
});

const testing = z.object({
  TEST_REPO: z.string().optional(),
  TEST_REPO_GITHUB_PAT: z.string().optional(),
});

const github = z.object({
  APP_ID: isDevelopmentMode ? z.coerce.number().optional() : z.coerce.number().min(1),
  PRIVATE_KEY: isDevelopmentMode ? z.string().optional() : z.string().min(1),
  WEBHOOK_SECRET_GITHUB: isDevelopmentMode ? z.string().optional() : z.string().min(1),
  WEBHOOK_PROXY_URL_GITHUB: urlOrUndef(),
});

const gitlab = z.object({
  GITLAB_OAUTH_APPLICATION_ID: z.string().optional(),
  GITLAB_OAUTH_APPLICATION_SECRET: z.string().optional(),
  GITLAB_PAT: z.string().optional(), // GitLab Personal Access Token for PoC
  GITLAB_BASE_URL: urlOrUndef(z.string().url().default('https://gitlab.com')), // GitLab instance URL
  WEBHOOK_SECRET_GITLAB: isDevelopmentMode ? z.string().optional() : z.string().min(1),
  WEBHOOK_PROXY_URL_GITLAB: urlOrUndef(),
});

const schema = base
  .merge(logging)
  .merge(service)
  .merge(loki)
  .merge(ai)
  .merge(testing)
  .merge(github)
  .merge(gitlab)
  .strict()
  .superRefine((v, ctx) => {
    // Loki all-or-nothing validation
    const lokiVars = [v.LOKI_URL, v.LOKI_USER, v.LOKI_TOKEN];
    const hasLokiValues = lokiVars.filter(Boolean);
    if (hasLokiValues.length > 0 && hasLokiValues.length !== 3) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        message: "LOKI_* variables must be all set or all empty" 
      });
    }
  });

// Extract keys from all subschemas
const knownKeys = Object.keys({
  ...base.shape,
  ...logging.shape,
  ...service.shape,
  ...loki.shape,
  ...ai.shape,
  ...testing.shape,
  ...github.shape,
  ...gitlab.shape,
});

const input = Object.fromEntries(knownKeys.map(k => [k, process.env[k]]));
const parsed = schema.safeParse(input);

if (!parsed.success) {
  console.error("❌ Environment validation failed:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const environment = Object.freeze({
  ...parsed.data,
  isDev: parsed.data.NODE_ENV === "development",
  isTest: parsed.data.NODE_ENV === "test",
  isProd: parsed.data.NODE_ENV === "production",
  isPreview: parsed.data.APP_ENV === "preview",
  
  loki: parsed.data.LOKI_URL ? { 
    url: parsed.data.LOKI_URL, 
    user: parsed.data.LOKI_USER, 
    token: parsed.data.LOKI_TOKEN, 
    enabled: true 
  } : { enabled: false },
  
  langfuse: parsed.data.LANGFUSE_PUBLIC_KEY ? { 
    publicKey: parsed.data.LANGFUSE_PUBLIC_KEY, 
    secretKey: parsed.data.LANGFUSE_SECRET_KEY, 
    baseUrl: parsed.data.LANGFUSE_BASE_URL, 
    enabled: true 
  } : { enabled: false },
});

