// React strips `key` and `ref` before they reach a component's props, so JSX
// must allow them on every element. Without this, every keyed list item in the
// codebase reports a false "key is not assignable" error and buries real ones.
//
// Host elements (<div>, <span>, …) get `style` and `className` typed properly
// and everything else left open. Typing every HTML attribute would produce
// noise across 200+ files; typing none of them — which is what a bare
// `[name: string]: any` does — hides the single most common real error in a
// React + TypeScript codebase: a style object built outside JSX, where
// 'wrap' widens to string and no longer satisfies the literal union.
//
// This file must stay a SCRIPT, not a module: no top-level import/export, or
// these declarations stop being global and every JSX tag fails to resolve.
declare namespace JSX {
  interface Element { [k: string]: any }
  interface ElementClass { render(): any }
  interface ElementAttributesProperty { props: {} }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: any; ref?: any }
  interface IntrinsicClassAttributes<T> { key?: any; ref?: any }
  interface HostProps {
    style?: React.CSSProperties;
    className?: string;
    key?: any;
    [k: string]: any;
  }
  interface IntrinsicElements { [name: string]: HostProps }
}
