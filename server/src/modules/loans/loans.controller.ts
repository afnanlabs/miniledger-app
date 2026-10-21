import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { currentUser, sendOk, validatedBody, validatedParams, validatedQuery } from '../../utils/http';
import type { CreateLoanInput, ListLoansQuery } from '../../schemas/loans.schema';
import * as loansService from './loans.service';

export const listLoans = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const query = validatedQuery<ListLoansQuery>(req);
  const result = await loansService.listLoansForUser(user.id, {
    status: query.status,
    limit: query.limit,
    offset: query.offset,
  });
  sendOk(res, result);
});

export const createLoan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const input = validatedBody<CreateLoanInput>(req);
  const loan = await loansService.createLoanForUser(user.id, input);
  sendOk(res, loan, 201);
});

export const getLoan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const { id } = validatedParams<{ id: string }>(req);
  const loan = await loansService.getLoanForUser(user.id, id);
  sendOk(res, loan);
});

export const repayLoan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const { id } = validatedParams<{ id: string }>(req);
  const loan = await loansService.repayLoanForUser(user.id, id);
  sendOk(res, loan);
});
