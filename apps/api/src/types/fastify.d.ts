import { FastifyRequest, FastifyInstance } from 'fastify';
import { Session } from '@fastify/session';
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      username: string;
      email: string;
    } | null;
  }
  interface FastifyReply {
    generateCsrf: () => Promise<string>;
  }
  interface FastifyInstance {
    serializeCookie: (name: string, value: string, options?: any) => string;
    parseCookie: (cookieHeader: string) => Record<string, string>;
    cookie: (name: string, value: string, options?: any) => void;
    signCookie: (value: string) => string;
    unsignCookie: (value: string) => { valid: boolean; value: string };
  }
}
