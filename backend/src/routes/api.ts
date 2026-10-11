import { Router } from "express";
import { controllers as c } from "../controllers/platform.js";
export function apiRouter() {
  const r = Router();
  r.get("/collections", c.collections);
  r.post("/collections", c.createCollection);
  r.get("/collections/:id", c.collection);
  r.patch("/collections/:id", c.editCollection);
  r.delete("/collections/:id", c.deleteCollection);
  r.get("/collections/:id/questions", c.questions);
  r.post("/collections/:id/questions", c.addQuestion);
  r.get("/questions/:id", c.question);
  r.patch("/questions/:id", c.editQuestion);
  r.delete("/questions/:id", c.deleteQuestion);
  r.post("/collections/:id/import", c.import);
  r.get("/collections/:id/export", c.export);
  r.post("/collections/:id/sessions", c.createSession);
  r.get("/sessions/:id", c.session);
  r.post("/sessions/:id/questions/:questionId/rate", c.rate);
  r.post("/sessions/:id/complete", c.complete);
  r.get("/collections/:id/revision-queue", c.revision);
  r.get("/questions/:id/history", c.history);
  r.get("/dashboard", c.dashboard);
  r.get("/collections/:id/analytics", c.analytics);
  return r;
}
