import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { currentUser, sendOk } from '../../utils/http';
import * as summaryService from './summary.service';

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const summary = await summaryService.getSummaryForUser(user.id);
  sendOk(res, summary);
});
