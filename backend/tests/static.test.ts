import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app";

let directory: string;
let app: ReturnType<typeof createApp>;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), ".algodeck-static-"));
  await writeFile(join(directory, "index.html"), "<html>AlgoDeck</html>");
  await writeFile(join(directory, "app.js"), "console.log('AlgoDeck')");
  app = createApp(
    {
      NODE_ENV: "production",
      PORT: 3001,
      FRONTEND_ORIGIN: "https://demo.example",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLIC_KEY: "not-a-production-key-ever",
      LOG_LEVEL: "silent",
      TRUST_PROXY: 0,
    },
    { frontendDir: directory },
  );
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

it("serves the frontend and its deep links from the API process", async () => {
  for (const path of ["/", "/auth", "/app", "/app/practice/session-id"]) {
    const response = await request(app).get(path);
    expect(response.status).toBe(200);
    expect(response.text).toBe("<html>AlgoDeck</html>");
  }
  expect((await request(app).get("/app.js")).text).toBe(
    "console.log('AlgoDeck')",
  );
});
it("keeps API authentication and missing assets separate from SPA fallback", async () => {
  expect((await request(app).get("/api/collections")).status).toBe(401);
  expect((await request(app).get("/missing.js")).status).toBe(404);
});
it("allows the configured Supabase origin in the browser content security policy", async () => {
  const response = await request(app).get("/");
  expect(response.headers["content-security-policy"]).toContain(
    "connect-src 'self' https://example.supabase.co",
  );
});
