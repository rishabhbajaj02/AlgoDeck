import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import {
  collectionSchema,
  questionSchema,
  ratingInputSchema,
  importSchema,
  timezoneSchema,
  studyDate,
} from "@algodeck/shared";
import type { Platform } from "../services/platform.js";
export type ContextRequest = Request & {
  platform: Platform;
  requestId: string;
};
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});
const id = (req: Request, key = "id") =>
  z.string().uuid().parse(req.params[key]);
const day = (req: Request) =>
  studyDate(timezoneSchema.parse(req.query.timezone));
const handle =
  (
    fn: (req: ContextRequest, res: Response) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(fn(req as ContextRequest, res)).catch(next);
  };
export const controllers = {
  collections: handle(async (req, res) => {
    const archived = z
      .enum(["true", "false"])
      .default("false")
      .parse(req.query.archived);
    res.json(await req.platform.collections(archived === "true"));
  }),
  createCollection: handle(async (req, res) =>
    res
      .status(201)
      .json(
        await req.platform.createCollection(collectionSchema.parse(req.body)),
      ),
  ),
  collection: handle(async (req, res) =>
    res.json(await req.platform.collection(id(req))),
  ),
  editCollection: handle(async (req, res) =>
    res.json(
      await req.platform.editCollection(
        id(req),
        collectionSchema
          .partial()
          .refine(
            (v) => Object.keys(v).length > 0,
            "Provide at least one field",
          )
          .parse(req.body),
      ),
    ),
  ),
  deleteCollection: handle(async (req, res) => {
    await req.platform.deleteCollection(id(req));
    res.status(204).end();
  }),
  questions: handle(async (req, res) => {
    const filters = pageSchema
      .extend({
        search: z.string().max(200).optional(),
        category: z.string().max(80).optional(),
        pattern: z.string().max(80).optional(),
        status: z.enum(["", "unseen", "due", "overdue", "upcoming"]).optional(),
      })
      .parse(req.query);
    res.json(await req.platform.questions(id(req), filters, day(req)));
  }),
  addQuestion: handle(async (req, res) =>
    res
      .status(201)
      .json(
        await req.platform.addQuestion(id(req), questionSchema.parse(req.body)),
      ),
  ),
  question: handle(async (req, res) =>
    res.json(await req.platform.question(id(req))),
  ),
  editQuestion: handle(async (req, res) =>
    res.json(
      await req.platform.editQuestion(
        id(req),
        questionSchema
          .partial()
          .refine(
            (v) => Object.keys(v).length > 0,
            "Provide at least one field",
          )
          .parse(req.body),
      ),
    ),
  ),
  deleteQuestion: handle(async (req, res) => {
    await req.platform.deleteQuestion(id(req));
    res.status(204).end();
  }),
  import: handle(async (req, res) => {
    const input = importSchema.parse(req.body);
    res.json(
      await req.platform.importQuestions(id(req), input.format, input.content),
    );
  }),
  export: handle(async (req, res) => {
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="algodeck-collection.json"',
    );
    res.json(await req.platform.exportCollection(id(req)));
  }),
  createSession: handle(async (req, res) => {
    const input = z
      .object({ timezone: timezoneSchema })
      .strict()
      .parse(req.body ?? {});
    res.json(
      await req.platform.createSession(id(req), studyDate(input.timezone)),
    );
  }),
  session: handle(async (req, res) =>
    res.json(await req.platform.session(id(req))),
  ),
  rate: handle(async (req, res) =>
    res.json(
      await req.platform.rate(
        id(req),
        id(req, "questionId"),
        ratingInputSchema.parse(req.body),
      ),
    ),
  ),
  complete: handle(async (req, res) => {
    z.object({})
      .strict()
      .parse(req.body ?? {});
    res.json(await req.platform.complete(id(req)));
  }),
  history: handle(async (req, res) => {
    const page = pageSchema.parse(req.query);
    res.json(await req.platform.history(id(req), page.page, page.page_size));
  }),
  revision: handle(async (req, res) => {
    const page = pageSchema.extend({status:z.enum(['unseen','due','overdue','upcoming']).optional()}).parse(req.query);
    const queue = await req.platform.revision(id(req), day(req));
    const rows = page.status ? queue.filter(q=>q.review_status===page.status) : queue;
    res.json({
      items: rows.slice(
        (page.page - 1) * page.page_size,
        page.page * page.page_size,
      ),
      total: rows.length,
      ...page,
    });
  }),
  dashboard: handle(async (req, res) =>
    res.json(await req.platform.dashboard(day(req))),
  ),
  analytics: handle(async (req, res) =>
    res.json(await req.platform.analytics(id(req), day(req))),
  ),
};
