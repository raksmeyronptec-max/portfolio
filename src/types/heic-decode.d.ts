/**
 * Minimal type declaration for `heic-decode`.
 *
 * The package ships no types. Declared narrowly rather than as `any` so the one
 * call site in `lib/media/process.ts` is still checked — the shape below is the
 * documented return of the default export, and getting `data` wrong is exactly
 * the mistake that would produce a silently mangled image.
 */
declare module "heic-decode" {
  /** One decoded frame as raw, top-to-bottom RGBA. */
  export type HeicFrame = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };

  export default function decode(input: {
    buffer: Buffer | Uint8Array;
  }): Promise<HeicFrame>;

  /** Every frame of a multi-image file. Unused here; a story wants one still. */
  export function all(input: {
    buffer: Buffer | Uint8Array;
  }): Promise<Array<{ decode: () => Promise<HeicFrame> }>>;
}
