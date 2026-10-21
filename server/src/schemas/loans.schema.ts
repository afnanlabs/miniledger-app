import { z } from 'zod';
import { isPositiveMoneyString, isValidMoneyString, numberToDecimalString } from '../utils/money';
import { isValidDateString } from '../utils/dates';
import { paginationSchema } from './common.schema';

/** Friend name shown on the loan card. */
export const friendNameSchema = z
  .string({ error: "Friend's name is required" })
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, 'Name must be 80 characters or fewer');

/**
 * Amount in INR.
 *
 * Accepted as a string ("1500", "1500.50") or a number, always validated and
 * stored as a decimal string so no floating point rounding can occur.
 */
export const amountSchema = z
  .union([z.string(), z.number()], { error: 'Amount is required' })
  .transform((value) => (typeof value === 'number' ? numberToDecimalString(value) : value.trim()))
  .refine((value) => isValidMoneyString(value), {
    message: 'Enter a valid amount with up to 2 decimal places (maximum 9999999999.99)',
  })
  .refine((value) => isPositiveMoneyString(value), { message: 'Amount must be greater than 0' });

/** Due date as a calendar date in `YYYY-MM-DD` form. */
export const dueDateSchema = z
  .string({ error: 'Due date is required' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must use the YYYY-MM-DD format')
  .refine((value) => isValidDateString(value), { message: 'Due date is not a real calendar date' });

export const createLoanSchema = z.object({
  friendName: friendNameSchema,
  amount: amountSchema,
  dueDate: dueDateSchema,
});

/**
 * PATCH accepts any subset of the create fields, but an empty body is not a
 * meaningful update and is rejected instead of silently doing nothing.
 */
export const updateLoanSchema = createLoanSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listLoansQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'repaid', 'all']).default('all'),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;
