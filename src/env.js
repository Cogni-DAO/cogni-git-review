const NODE_ENV = process.env.NODE_ENV || "development"; // dev|test|production only
const APP_ENV = (process.env.APP_ENV  || "dev").toLowerCase();

export const env = Object.freeze({
  node: NODE_ENV,
  app: APP_ENV,                 // dev | preview | prod
  isDev: NODE_ENV === "development",
  isTest: NODE_ENV === "test",
  isProd: NODE_ENV === "production",
});