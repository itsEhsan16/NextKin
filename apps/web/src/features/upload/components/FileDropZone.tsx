import { useId, useState, type DragEvent } from 'react';

import { cn } from '@/lib/cn';
import { JdUploadHeroIllustration } from '@/ui/illustrations';

import { FILE_ACCEPT } from '../uploadLibrary';

/**
 * The dashed drop zone (247:573). The whole zone is the file input's label, so a click anywhere
 * opens the picker and a drop anywhere takes the file. The character with her JD is the board's
 * vector (261:781, 226×177), shown 112px tall. The board's saturated dashed edge (#9f91ff) is the
 * app's lavender `border-brand-strong`; it turns full brand while a file is dragged over it.
 */
export function FileDropZone({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);
  const inputId = useId();
  const hintId = useId();

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        'flex cursor-pointer flex-col items-center rounded-lg border border-dashed px-6 pb-5 pt-4 text-center transition-colors duration-press ease-standard has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600',
        over
          ? 'border-brand-600 bg-surface-brand-strong'
          : 'border-border-brand-strong bg-surface-brand hover:bg-surface-brand-strong',
      )}
    >
      <JdUploadHeroIllustration className="h-[112px] w-auto" />
      <span className="mt-2 text-body-l font-semibold text-text-primary">
        Drag and drop your job description here
      </span>
      <span className="mt-1 text-body-m text-text-secondary">
        or <span className="font-semibold text-text-brand">click to browse files</span>
      </span>
      <span id={hintId} className="mt-3 text-body-s text-text-tertiary">
        Supports PDF, DOC, DOCX, TXT (Max 5MB)
      </span>
      <input
        id={inputId}
        type="file"
        accept={FILE_ACCEPT}
        aria-label="Job description file"
        aria-describedby={hintId}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Cleared, so picking the same file again after removing it still fires a change.
          event.target.value = '';
        }}
      />
    </label>
  );
}
