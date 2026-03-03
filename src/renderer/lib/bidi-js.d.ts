declare module 'bidi-js' {
  interface EmbeddingLevelsResult {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }

  interface BidiInstance {
    getEmbeddingLevels(text: string, baseDirection?: 'ltr' | 'rtl' | 'auto'): EmbeddingLevelsResult;
    getReorderedIndices(text: string, result: EmbeddingLevelsResult, start?: number, end?: number): number[];
    getMirroredCharacter(char: string): string | null;
  }

  function bidiFactory(): BidiInstance;
  export default bidiFactory;
}
