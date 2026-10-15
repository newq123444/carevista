// Stand-ins for the backend's npm packages, so the backend can be type-checked
// where node_modules cannot be installed. Deliberately loose (mostly `any`):
// they exist to let tsc check OUR code — wrong names, wrong arity, nullable
// misuse, missing returns — not the libraries. Shapes follow @types/* where
// our code depends on them (Request.user, Express.Multer.File, SignOptions).

// A script file (no top-level import/export), so these are global and the
// `declare module` blocks below are ambient declarations, not augmentations.
declare namespace Express {
  interface Request {}
  namespace Multer { interface File { fieldname: string; originalname: string; mimetype: string; size: number; filename: string; path: string; buffer: Buffer; [k: string]: any } }
}

declare module 'express' {
  namespace e {
    interface Request extends Express.Request {
      body: any; query: any; params: any; headers: any; cookies?: any;
      ip?: string; method: string; path: string; url: string; originalUrl: string;
      get(name: string): string | undefined;
      file?: Express.Multer.File; files?: any;
      [k: string]: any;
    }
    interface Response {
      status(code: number): Response; json(body?: any): Response; send(body?: any): Response;
      setHeader(name: string, value: any): Response; set(...a: any[]): Response; end(...a: any[]): any;
      write(chunk: any): boolean; flushHeaders(): void; on(ev: string, fn: (...a: any[]) => void): any;
      headersSent: boolean; locals: any; [k: string]: any;
    }
    type NextFunction = (err?: any) => void;
    type Handler = (req: Request, res: Response, next: NextFunction) => any;
    type RequestHandler = Handler;
    type ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => any;
    interface IRouter {
      get(path: any, ...handlers: Handler[]): IRouter; post(path: any, ...handlers: Handler[]): IRouter;
      put(path: any, ...handlers: Handler[]): IRouter; patch(path: any, ...handlers: Handler[]): IRouter;
      delete(path: any, ...handlers: Handler[]): IRouter; options(path: any, ...handlers: Handler[]): IRouter;
      all(path: any, ...handlers: Handler[]): IRouter;
      use(handler: Handler, ...rest: Handler[]): IRouter;
      use(handler: ErrorRequestHandler): IRouter;
      use(path: string, ...handlers: Array<Handler | IRouter>): IRouter;
      use(...handlers: Array<Handler | IRouter>): IRouter;
    }
    interface Express extends IRouter { listen(...a: any[]): any; set(...a: any[]): any; disable(...a: any[]): any; enable(...a: any[]): any }
    type Router = IRouter;
    function Router(opts?: any): IRouter;
    function json(opts?: any): Handler;
    function urlencoded(opts?: any): Handler;
    function raw(opts?: any): Handler;
  }
  function e(): e.Express;
  export = e;
}

declare module 'pg' {
  export type PoolClient = { query: <T = any>(sql: string, params?: any[]) => Promise<QueryResult<T>>; release: (err?: any) => void; [k: string]: any };
  export type QueryResultRow = any;
  export interface QueryResult<T = any> { rows: T[]; rowCount: number | null; [k: string]: any }
  export class Pool { constructor(cfg?: any); query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>; connect(): Promise<PoolClient>; end(): Promise<void>; on(ev: string, fn: (...a: any[]) => void): any; [k: string]: any }
  export class Client { constructor(cfg?: any); query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>; connect(): Promise<void>; end(): Promise<void>; [k: string]: any }
  export const types: any;
  const pg: { Pool: typeof Pool; Client: typeof Client; types: any };
  export default pg;
}

declare module 'jsonwebtoken' {
  namespace jwt { type SignOptions = any; type JwtPayload = any; function sign(...a: any[]): string; function verify(...a: any[]): any; function decode(...a: any[]): any; }
  export = jwt;
}

declare module 'multer' {
  namespace multer {
    type FileFilterCallback = (error: Error | null, accept?: boolean) => void;
    function diskStorage(o: {
      destination?: string | ((req: any, file: Express.Multer.File, cb: (e: Error | null, dest: string) => void) => void);
      filename?: (req: any, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) => void;
    }): any;
    function memoryStorage(): any;
  }
  function multer(o?: any): any;
  export = multer;
}

declare module 'zod' {
  export type ZodIssue = { path: (string | number)[]; message: string; code?: string; [k: string]: any };
  export type ZodSchema<T = any> = {
    safeParse(v: any): { success: true; data: T } | { success: false; error: { issues: ZodIssue[]; errors: ZodIssue[]; [k: string]: any } };
    parse(v: any): T; [k: string]: any;
  };
  export type ZodTypeAny = any;
  export const z: any;
  export class ZodError extends Error { issues: any[]; errors: any[] }
}

declare module '@anthropic-ai/sdk' {
  export default class Anthropic {
    constructor(o?: any);
    messages: { create(o: any): Promise<{ content: Array<{ type: string; [k: string]: any }>; [k: string]: any }> };
    [k: string]: any;
  }
}

declare module 'cors' {
  function cors(o?: { origin?: boolean | string | string[] | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void); [k: string]: any }): any;
  export = cors;
}

declare module 'morgan' {
  function morgan(format: string, o?: { stream?: { write: (msg: string) => any }; skip?: (req: any, res: any) => boolean; [k: string]: any }): any;
  export = morgan;
}

declare module 'winston' {
  const winston: {
    createLogger(o: any): any;
    format: { [k: string]: any; printf(fn: (info: { [k: string]: any }) => string): any };
    transports: any;
  };
  export default winston;
}

declare module 'bcryptjs'; declare module 'compression'; declare module 'dotenv'; declare module 'dotenv/config';
declare module 'express-rate-limit' {
  function rateLimit(o?: { skip?: (req: import('express').Request, res: import('express').Response) => boolean; [k: string]: any }): any;
  export default rateLimit;
}
declare module 'helmet'; declare module 'ioredis'; declare module 'nodemailer';
declare module 'uuid';

