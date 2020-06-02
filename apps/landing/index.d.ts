declare module '*.svg' {
  const content: any;
  export const ReactComponent: any;
  export default content;
}

declare module '*.png' {
  const value: any;
  export = value;
}
