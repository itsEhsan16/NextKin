import { handleApiRequest } from '@nextkin/server/next';

// The whole API lives in @nextkin/server (V2 §9.3: "the backend is the Next.js server itself").
// This file stays thin on purpose: every route, middleware and test is in the server package, so
// it runs without Next. ImBackendImplementationPlan P1-09 / P3-01.

// Node, not the edge runtime: the server needs pg, Valkey and the AWS SDK.
export const runtime = 'nodejs';
// Every response is per-request; nothing here may be statically cached.
export const dynamic = 'force-dynamic';

export const GET = handleApiRequest;
export const POST = handleApiRequest;
export const PUT = handleApiRequest;
export const PATCH = handleApiRequest;
export const DELETE = handleApiRequest;
export const OPTIONS = handleApiRequest;
export const HEAD = handleApiRequest;
