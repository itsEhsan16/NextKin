import { FirstResumePrompt } from './components/FirstResumePrompt';
import { useFirstResume } from './hooks/useFirstResume';

/**
 * Home's first-resume pop-up and the after-sign-up redirect (§185), mounted in the tabs layout
 * after the floating tab bar, like the Home menu, so the sheet covers the bar instead of sitting
 * under it.
 */
export function FirstResumeHost() {
  const firstResume = useFirstResume();
  return (
    <FirstResumePrompt
      open={firstResume.promptOpen}
      onUpload={firstResume.upload}
      onFillDetails={firstResume.fillDetails}
      onLater={firstResume.later}
    />
  );
}
