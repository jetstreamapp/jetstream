import type { Prisma } from '@jetstream/prisma';
import { z } from 'zod';
import { createAnalysisJob, getAnalysisJobForUser, listAnalysisJobsForUserOrg } from '../db/analysis-job.db';
import { enqueuePermissionExportJobProcessing } from '../services/analysis-job-processor.service';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

const jobTypeSchema = z.enum(['permission_export', 'field_usage']);

export const routeDefinition = {
  createJob: {
    controllerFn: () => createJob,
    validators: {
      hasSourceOrg: true,
      body: z.object({
        jobType: jobTypeSchema,
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
    } satisfies RouteValidator,
  },
  listJobs: {
    controllerFn: () => listJobs,
    validators: {
      hasSourceOrg: true,
      query: z.object({
        limit: z.coerce.number().min(1).max(50).default(20),
      }),
    } satisfies RouteValidator,
  },
  getJob: {
    controllerFn: () => getJob,
    validators: {
      hasSourceOrg: true,
      params: z.object({
        id: z.string().uuid(),
      }),
    } satisfies RouteValidator,
  },
};

const createJob = createRoute(routeDefinition.createJob.validators, async ({ body, user, org }, _req, res, next) => {
  try {
    const job = await createAnalysisJob({
      userId: user.id,
      salesforceOrgUniqueId: org.uniqueId,
      jobType: body.jobType,
      initialResult: body.payload ? ({ requestPayload: body.payload } as Prisma.InputJsonValue) : undefined,
    });
    if (body.jobType === 'permission_export') {
      enqueuePermissionExportJobProcessing(job.id);
    }
    sendJson(res, { job });
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const listJobs = createRoute(routeDefinition.listJobs.validators, async ({ query, user, org }, _req, res, next) => {
  try {
    const jobs = await listAnalysisJobsForUserOrg({
      userId: user.id,
      salesforceOrgUniqueId: org.uniqueId,
      take: query.limit,
    });
    sendJson(res, { jobs });
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const getJob = createRoute(routeDefinition.getJob.validators, async ({ params, user }, _req, res, next) => {
  try {
    const job = await getAnalysisJobForUser({ id: params.id, userId: user.id });
    if (!job) {
      sendJson(res, { error: 'Job not found' }, 404);
      return;
    }
    sendJson(res, { job });
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});
