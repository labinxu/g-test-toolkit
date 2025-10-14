import type { FastifyPluginCallback } from 'fastify';

declare module '@fastify/cookie' {
  type SameSite = 'lax' | 'none' | 'strict' | boolean;

  interface CookieSerializeOptions {
    domain?: string;
    encode?(value: string): string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    partitioned?: boolean;
    path?: string;
    sameSite?: SameSite;
    priority?: 'low' | 'medium' | 'high';
    secure?: boolean | 'auto';
    signed?: boolean;
  }

  interface ParseOptions {
    decode?(value: string): string;
  }

  interface UnsignResultValid {
    valid: true;
    renew: boolean;
    value: string;
  }

  interface UnsignResultInvalid {
    valid: false;
    renew: false;
    value: null;
  }

  type UnsignResult = UnsignResultValid | UnsignResultInvalid;

  interface FastifyCookieOptions {
    secret?: string | string[] | Buffer | Buffer[];
    algorithm?: string;
    hook?: 'onRequest' | 'preParsing' | 'preValidation' | 'preHandler' | 'preSerialization' | false;
    parseOptions?: CookieSerializeOptions;
  }

  const fastifyCookie: FastifyPluginCallback<FastifyCookieOptions> & {
    parse(cookieHeader: string, opts?: ParseOptions): Record<string, string>;
    serialize(name: string, value: string, opts?: CookieSerializeOptions): string;
    unsign(value: string): UnsignResult;
  };

  export type { CookieSerializeOptions, FastifyCookieOptions, ParseOptions, UnsignResult };
  export default fastifyCookie;
}

declare module 'fastify' {
  import type { CookieSerializeOptions, UnsignResult } from '@fastify/cookie';

  interface FastifyReply {
    setCookie(name: string, value: string, options?: CookieSerializeOptions): this;
    clearCookie(name: string, options?: CookieSerializeOptions): this;
    cookie(name: string, value: string, options?: CookieSerializeOptions): this;
    cookies: Record<string, string | undefined>;
    unsignCookie(value: string): UnsignResult;
  }

  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
  }

  interface FastifyInstance {
    serializeCookie(name: string, value: string, options?: CookieSerializeOptions): string;
    parseCookie(cookieHeader: string): Record<string, string>;
    unsignCookie(value: string): UnsignResult;
  }
}
