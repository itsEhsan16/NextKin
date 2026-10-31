import { useState } from 'react';

import { isUnreadableFileError, useImportResume } from '@/data/queries';
import { pickDocument } from '@/lib';
import { showAppToast } from '@/ui/Toast';

import { useBuildSourceStore } from '../buildSourceStore';

/**
 * "Upload from your device" on BUILD 01's source sheet (toreview §139): a PDF or DOCX is read
 * into a resume, which then becomes what the build starts from. `reading` names the file while
 * it is read, so the foot row can say so; a file that cannot be read is said in a toast and the
 * source stays as it was.
 */
export function useBuildSourceUpload() {
  const importResume = useImportResume();
  const pick = useBuildSourceStore((state) => state.pick);
  const [reading, setReading] = useState<string | null>(null);

  const upload = async () => {
    const file = await pickDocument(['pdf', 'docx']);
    if (!file) return;
    setReading(file.name);
    try {
      const { resume } = await importResume.mutateAsync(file);
      pick(resume.id);
    } catch (error) {
      showAppToast(
        isUnreadableFileError(error)
          ? 'We couldn’t read that file. Use a PDF or DOCX with text you can select.'
          : 'That upload didn’t go through. Check your connection and try again.',
        'error',
      );
    } finally {
      setReading(null);
    }
  };

  return { reading, upload };
}
