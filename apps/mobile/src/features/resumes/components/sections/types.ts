/**
 * The one shape every section body takes (V2 §7.11). The screen owns the draft, so a body is a
 * controlled view of one slice of it and never talks to the query layer itself.
 */
export type SectionFieldsProps<T> = {
  value: T;
  onChange: (next: T) => void;
  /**
   * Only the errors that have earned the right to be seen — the screen filters `validateSection`
   * down to the fields the reader has left, plus everything once a Save has been refused. A rule
   * shown on the first keystroke reads as a telling-off for typing.
   */
  errors: Record<string, string>;
  /** Marks one field touched, so its error may appear from here on. */
  onBlurField?: (key: string) => void;
};
