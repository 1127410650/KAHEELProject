import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { signInWithIdentifierImpl } from "./auth.server";

const schema = z.object({
  identifier: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
});

export const signInWithIdentifier = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => signInWithIdentifierImpl(data.identifier, data.password));
