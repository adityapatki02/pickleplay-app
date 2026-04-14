declare module 'dom-to-image-more' {
  interface Options {
    quality?: number;
    bgcolor?: string;
    cacheBust?: boolean;
    width?: number;
    height?: number;
    filter?: (node: Node) => boolean;
    style?: Record<string, any>;
  }
  const domtoimage: {
    toBlob: (node: any, options?: Options) => Promise<Blob>;
    toJpeg: (node: any, options?: Options) => Promise<string>;
    toPng: (node: any, options?: Options) => Promise<string>;
    toSvg: (node: any, options?: Options) => Promise<string>;
  };
  export default domtoimage;
}

declare module 'file-saver' {
  export function saveAs(
    data: Blob | string,
    filename?: string,
    options?: { autoBom?: boolean },
  ): void;
}
