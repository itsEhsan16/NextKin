/** The part of `word-extractor` (MIT, no bundled types) the .doc reader uses. */
declare module 'word-extractor' {
  interface WordDocument {
    getBody(options?: { filterUnicode?: boolean }): string;
    getTextboxes(options?: { filterUnicode?: boolean; includeHeadersAndFooters?: boolean; includeBody?: boolean }): string;
  }
  export default class WordExtractor {
    extract(source: string | Buffer): Promise<WordDocument>;
  }
}
