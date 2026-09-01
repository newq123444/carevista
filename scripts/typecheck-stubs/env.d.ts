// Vite/browser globals that would normally come from vite/client and lib.dom.
interface ImportMetaEnv { readonly [k: string]: any }
interface ImportMeta { readonly env: ImportMetaEnv }
declare module '*.css' {}
declare module '*.svg' { const s: string; export default s; }
declare module '*.png' { const s: string; export default s; }
