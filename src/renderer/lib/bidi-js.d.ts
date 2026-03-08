declare module 'bidi-js' {
  interface EmbeddingLevelsResult {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }

  interface BidiInstance {
    getEmbeddingLevels(
      string: string,
      baseDirection?: 'ltr' | 'rtl' | 'auto'
    ): EmbeddingLevelsResult;

    getReorderedIndices(
      string: string,
      embedLevelsResult: EmbeddingLevelsResult,
      start?: number,
      end?: number
    ): Uint32Array;

    getReorderedString(
      string: string,
      embedLevelsResult: EmbeddingLevelsResult,
      start?: number,
      end?: number
    ): string;

    getMirroredCharacter(char: string): string | null;
  }

  function bidiFactory(): BidiInstance;
  export default bidiFactory;
}
