import { z } from 'zod';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A UUID v1-v5 identifier. */
export const uuidSchema = z
  .string({ error: 'Identifier is required' })
  .trim()
  .regex(UUID_PATTERN, 'Invalid identifier');

/** Route parameter object for `/:id` routes. */
export const idParamSchema = z.object({ id: uuidSchema });

/** Shared pagination query parameters. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof paginationSchema>;
