// Permissive stand-ins for packages we cannot install (npm registry blocked).
// The point is NOT to typecheck React — it is to let tsc RESOLVE these imports
// so it will then typecheck OUR code against OUR interfaces. Anything left as
// `any` here is deliberately unchecked; the generics exist only so that our
// own `useState<Foo>()` calls do not produce noise that would bury real errors.

declare namespace React {
  type ReactNode = any;
  type ReactElement = any;
  type FormEvent<T = any> = any;
  type ChangeEvent<T = any> = any;
  type MouseEvent<T = any> = any;
  type KeyboardEvent<T = any> = any;
  type DragEvent<T = any> = any;
  type PointerEvent<T = any> = any;
  type TouchEvent<T = any> = any;
  type FocusEvent<T = any> = any;
  type WheelEvent<T = any> = any;
  type ClipboardEvent<T = any> = any;
  type UIEvent<T = any> = any;
  type SyntheticEvent<T = any> = any;
  // Not the real CSSProperties, but narrow on the properties that actually
  // break real builds: the ones typed as string-literal unions upstream. A
  // style object assembled outside JSX widens 'wrap' to string and fails there
  // while passing a permissive stub — which is exactly the gap that let a
  // broken build through before.
  interface CSSProperties {
    display?: 'none'|'block'|'inline'|'inline-block'|'flex'|'inline-flex'|'grid'|'inline-grid'|'contents'|'table'|'table-cell'|'table-row'|'list-item';
    position?: 'static'|'relative'|'absolute'|'fixed'|'sticky';
    flexDirection?: 'row'|'row-reverse'|'column'|'column-reverse';
    flexWrap?: 'nowrap'|'wrap'|'wrap-reverse';
    justifyContent?: 'flex-start'|'flex-end'|'center'|'space-between'|'space-around'|'space-evenly'|'start'|'end'|'left'|'right'|'stretch'|'normal';
    alignItems?: 'flex-start'|'flex-end'|'center'|'baseline'|'stretch'|'start'|'end'|'normal'|'self-start'|'self-end';
    alignSelf?: 'auto'|'flex-start'|'flex-end'|'center'|'baseline'|'stretch'|'start'|'end';
    justifySelf?: 'auto'|'start'|'end'|'center'|'stretch'|'flex-start'|'flex-end'|'left'|'right';
    textAlign?: 'left'|'right'|'center'|'justify'|'start'|'end';
    textTransform?: 'none'|'capitalize'|'uppercase'|'lowercase';
    whiteSpace?: 'normal'|'nowrap'|'pre'|'pre-wrap'|'pre-line'|'break-spaces';
    overflow?: 'visible'|'hidden'|'clip'|'scroll'|'auto';
    overflowX?: 'visible'|'hidden'|'clip'|'scroll'|'auto';
    overflowY?: 'visible'|'hidden'|'clip'|'scroll'|'auto';
    overflowWrap?: 'normal'|'break-word'|'anywhere';
    wordBreak?: 'normal'|'break-all'|'keep-all'|'break-word';
    textOverflow?: 'clip'|'ellipsis'|(string & {});
    cursor?: 'auto'|'default'|'pointer'|'wait'|'text'|'move'|'not-allowed'|'grab'|'grabbing'|'help'|'crosshair'|'progress'|'none'|(string & {});
    visibility?: 'visible'|'hidden'|'collapse';
    boxSizing?: 'content-box'|'border-box';
    objectFit?: 'fill'|'contain'|'cover'|'none'|'scale-down';
    pointerEvents?: 'auto'|'none'|(string & {});
    userSelect?: 'auto'|'none'|'text'|'all'|'contain';
    [k: string]: any;
  }
  type FC<P = any> = (props: P) => any;
  type ComponentType<P = any> = any;
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prev: S) => S);
  type MutableRefObject<T> = { current: T };
  type RefObject<T> = { current: T | null };
  type ErrorInfo = any;
  type PropsWithChildren<P = {}> = P & { children?: any };
  type Ref<T = any> = any;
  type Key = any;
  interface Context<T> { Provider: any; Consumer: any; displayName?: string; __t?: T }
  class Component<P = any, S = any> {
    constructor(props?: P);
    props: P; state: S; setState(s: any): void; render(): any;
  }
}

declare module 'react' {
  export function useState<S>(initial: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, React.Dispatch<React.SetStateAction<S | undefined>>];
  export function useEffect(fn: () => any, deps?: any[]): void;
  export function useLayoutEffect(fn: () => any, deps?: any[]): void;
  export function useMemo<T>(fn: () => T, deps?: any[]): T;
  export function useCallback<T extends (...a: any[]) => any>(fn: T, deps?: any[]): T;
  export function useRef<T>(initial: T): React.MutableRefObject<T>;
  export function useRef<T = undefined>(): React.MutableRefObject<T | undefined>;
  export interface Context<T> { Provider: any; Consumer: any; displayName?: string; __t?: T }
  export function useContext<T>(ctx: Context<T>): T;
  export function createContext<T>(def: T): Context<T>;
  export function useReducer(...a: any[]): any;
  export const Fragment: any, StrictMode: any, Suspense: any;
  export const memo: any, lazy: any, forwardRef: any, createElement: any, cloneElement: any;
  export const Children: any;
  export class Component<P = any, S = any> {
    constructor(props?: P);
    props: P; state: S; setState(s: any): void; render(): any;
  }
  export type ReactNode = React.ReactNode;
  export type ReactElement = React.ReactElement;
  export type FormEvent<T = any> = React.FormEvent<T>;
  export type ChangeEvent<T = any> = React.ChangeEvent<T>;
  export type MouseEvent<T = any> = React.MouseEvent<T>;
  export type KeyboardEvent<T = any> = React.KeyboardEvent<T>;
  export type DragEvent<T = any> = React.DragEvent<T>;
  export type PointerEvent<T = any> = React.PointerEvent<T>;
  export type TouchEvent<T = any> = React.TouchEvent<T>;
  export type FocusEvent<T = any> = React.FocusEvent<T>;
  export type WheelEvent<T = any> = React.WheelEvent<T>;
  export type ClipboardEvent<T = any> = React.ClipboardEvent<T>;
  export type UIEvent<T = any> = React.UIEvent<T>;
  export type SyntheticEvent<T = any> = React.SyntheticEvent<T>;
  export type CSSProperties = React.CSSProperties;
  export type FC<P = any> = React.FC<P>;
  export type ComponentType<P = any> = React.ComponentType<P>;
  export type ErrorInfo = React.ErrorInfo;
  export type PropsWithChildren<P = {}> = React.PropsWithChildren<P>;
  export type Dispatch<A> = React.Dispatch<A>;
  export type SetStateAction<S> = React.SetStateAction<S>;
  export type MutableRefObject<T> = React.MutableRefObject<T>;
  export type RefObject<T> = React.RefObject<T>;
  // `import React from 'react'` then `React.useRef<HTMLInputElement>(null)` is
  // common in this codebase, so the default export needs the hooks on it too.
  const React_: {
    useState: typeof useState; useEffect: typeof useEffect; useMemo: typeof useMemo;
    useCallback: typeof useCallback; useRef: typeof useRef; useContext: typeof useContext;
    createContext: typeof createContext; useReducer: any; useLayoutEffect: typeof useLayoutEffect;
    Fragment: any; StrictMode: any; Suspense: any; memo: any; lazy: any;
    forwardRef: any; createElement: any; cloneElement: any; Children: any;
    Component: typeof Component;
    [k: string]: any;
  };
  export default React_;
}
declare module 'react/jsx-runtime' { export const jsx: any, jsxs: any, Fragment: any; }
declare module 'react/jsx-dev-runtime' { export const jsxDEV: any, Fragment: any; }
declare module 'react-dom/client' { const d: any; export default d; export const createRoot: any; }
declare module 'react-dom' { const d: any; export default d; export const createPortal: any; }

// Zustand keeps its real shape: our store's own type is what we want checked.
declare module 'zustand' {
  export function create<T>(initializer: (set: any, get: any) => T): {
    (): T;
    <U>(selector: (state: T) => U): U;
    getState(): T;
    setState(partial: any): void;
    subscribe(listener: any): () => void;
  };
}

declare module 'axios' {
  export interface AxiosResponse<T = any> { data: T; status: number; headers: any; }
  export interface AxiosRequestConfig { [k: string]: any; }
  export interface AxiosError<T = any> { response?: AxiosResponse<T>; message: string; code?: string; }
  export interface AxiosInstance {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    interceptors: any;
    defaults: any;
  }
  const axios: AxiosInstance & { create(cfg?: any): AxiosInstance; isAxiosError(e: any): boolean; };
  export default axios;
}

declare module 'react-router-dom' {
  export const BrowserRouter: any, Routes: any, Route: any, Navigate: any,
    NavLink: any, Link: any, Outlet: any, HashRouter: any;
  export function useNavigate(): (to: any, opts?: any) => void;
  export function useParams<T = any>(): any;
  export function useLocation(): any;
  export function useSearchParams(): any;
}

declare module '@tanstack/react-query' {
  export class QueryClient {
    constructor(cfg?: any);
    invalidateQueries(f?: any): Promise<void>;
    cancelQueries(f?: any): Promise<void>;
    refetchQueries(f?: any): Promise<void>;
    removeQueries(f?: any): void;
    setQueryData(k: any, v: any): void;
    getQueryData(k: any): any;
    getQueryCache(): any;
    clear(): void;
  }
  export const QueryClientProvider: any;
  export function useQueryClient(): QueryClient;
  export function useQuery<T = any>(opts: any): {
    data: T; isLoading: boolean; isError: boolean; error: any;
    refetch: () => any; isFetching: boolean; isSuccess: boolean; status: string;
  };
  export function useMutation<TData = any, TErr = any, TVars = any>(opts: any): {
    mutate(vars?: TVars, opts?: { onSuccess?: (d: TData) => void; onError?: (e: TErr) => void; onSettled?: () => void }): void;
    mutateAsync(vars?: TVars): Promise<TData>;
    isPending: boolean; isError: boolean; isSuccess: boolean;
    error: TErr; data: TData; reset(): void; variables: TVars;
  };
  export function useInfiniteQuery(opts: any): any;
}

declare module 'date-fns' {
  export function format(d: any, f: string, o?: any): string;
  export function formatDistanceToNow(d: any, o?: any): string;
  export function parseISO(s: string): Date;
  export function differenceInDays(a: any, b: any): number;
  export function addDays(d: any, n: number): Date;
  export function subDays(d: any, n: number): Date;
  export function startOfDay(d: any): Date;
  export function isValid(d: any): boolean;
}


