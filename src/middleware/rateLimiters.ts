import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const skip = () => isDev;

export const perUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  keyGenerator: (req) => (req as any).user?.userId || ipKeyGenerator(req),
  skip,
  message: { success: false, error: 'Too many requests. Please slow down.', status: 429 },
});

export const perOrgLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  keyGenerator: (req) => (req as any).user?.orgId || ipKeyGenerator(req),
  skip,
  message: { success: false, error: 'Organisation rate limit exceeded.', status: 429 },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  skip,
  message: { success: false, error: 'Too many requests.', status: 429 },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip,
  message: { success: false, error: 'Too many auth attempts. Please try again later.', status: 429 },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => (req as any).user?.orgId || ipKeyGenerator(req),
  skip,
  message: { success: false, error: 'AI rate limit exceeded.', status: 429 },
});

export const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req as any).user?.userId || ipKeyGenerator(req),
  skip,
  message: { success: false, error: 'Assistant rate limit exceeded.', status: 429 },
});
