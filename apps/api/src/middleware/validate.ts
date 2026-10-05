import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type RequestTarget = "body" | "query" | "params";

export function validate(schema: ZodSchema, target: RequestTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
      return next(parsed.error);
    }

    req[target] = parsed.data;
    return next();
  };
}
