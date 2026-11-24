import { useState } from 'react';

import { startErrorLine } from '@/data/models/customize';
import { isConsentRequired, isUnreadableFileError, useImportResume } from '@/data/queries';
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
    // `mutate` with its own callbacks: after the consent dialog the import runs again, and these
    // still pick the resume it made; awaiting the first refusal left it unpicked (toreview §262).
    importResume.mutate(file, {
      onSuccess: ({ resume }) => {
        setReading(null);
        pick(resume.id);
      },
      onError: (error) => {
        setReading(null);
        // Consent has its own dialog; every other refusal says what it was.
        if (isConsentRequired(error)) return;
        showAppToast(
          isUnreadableFileError(error)
            ? 'We couldn’t read that file. Use a PDF or DOCX with text you can select.'
            : startErrorLine(
                error,
                'That upload didn’t go through. Check your connection and try again.',
              ),
          'error',
        );
      },
    });
  };

  return { reading, upload };
}
