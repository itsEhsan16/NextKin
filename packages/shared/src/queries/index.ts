/**
 * Types and errors that cross the repo boundary into the screens. Re-exported here so a screen
 * still imports only from @/data/queries: the export sheet names a format and has to recognise a
 * plan-locked refusal, and neither is worth a second import path into the data layer.
 */
export {
  ConsentRequiredError,
  ExportBlockedError,
  PlanLockedError,
  type AssistantSendInput,
  type CoverLetterPatch,
  type ExportFormat,
  type ResumeExport,
} from '../repos';
export { applyPageOf } from '../jobs/applyPage';
export { flushEvents, track } from './track';
export { EXPORT_BLOCK_MESSAGE, type ExportBlock } from '../models/exportBlock';
export { createQueryClient, isConsentRequired, onConsentRequired } from './client';
export { qk } from './keys';
export { queryPhase, type QueryPhase } from './queryPhase';
export {
  useAccountSecurity,
  useActivity,
  useChangePassword,
  useDataExport,
  useDeleteAccount,
  useRequestDataExport,
  useSignOutEverywhere,
  useUpdateAvatar,
  useUpdateEmail,
  useUpdateName,
} from './useAccount';
export { useActiveGeneration } from './useActiveGeneration';
export { SharedReportMissingError, useSharedReport } from './useSharedReport';
export type { SharedReport } from '../schemas/sharedReport';
export { useAppSettings, useUpdateAppSettings } from './useAppSettings';
export {
  useAssistantConversation,
  useAssistantReply,
  useAssistantThreads,
  useClearAssistant,
  useOpenAssistantThread,
  useSendAssistantMessage,
  useStartAssistantChat,
  type AssistantReplyState,
} from './useAssistant';
export { useInsights } from './useInsights';
export { useAdminActivity, useAdminMe, useAdminOverview, useAdminQueues } from './useAdmin';
export * from './useAdminPeople';
export * from './useAdminContent';
export * from './useAdminBusiness';
export * from './useAdminTrust';
export {
  useBilling,
  useCancelSubscription,
  usePauseSubscription,
  usePlans,
  useResumeSubscription,
  useUpdateBillingSettings,
  useUpgradePlan,
  useWithdrawSubscription,
} from './useBilling';
export { useAiConsent, useGrantAiConsent } from './useAiConsent';
export { degradedMessages, useServiceStatus, type ServiceStatus } from './useServiceStatus';
export {
  useConnectAccount,
  useConnectedAccounts,
  useDisconnectAccount,
} from './useConnectedAccounts';
export { useDocuments } from './useDocuments';
export { STALL_FAIL_MS, STALL_SLOW_MS, useStall, type Stall } from './useStall';
export {
  useCancelGeneration,
  useGeneration,
  useGenerations,
  useRetryGeneration,
  useStartGeneration,
} from './useGenerations';
export {
  useInterviewSet,
  useInterviewSetForGeneration,
  useInterviewSets,
  useMarkInterviewQuestion,
  useRemoveInterviewSet,
  useResetInterviewMarks,
} from './useInterview';
export {
  isUnreadableLinkError,
  unreadableLinkMessage,
  useExtractJd,
  JD_READING_POLL_MS,
  useJdDraft,
  useJobJd,
  useTailorComparison,
  useUpdateJdDraft,
} from './useJd';
export { unreadableJdId, useDraftFigure, useJdComparison, useJdJob, useJdMatch } from './useJdJob';
export type { JobFactsKnown } from '../jobs/fromJd';
export {
  useApplications,
  useHiddenPicks,
  useJobFit,
  useCheckInApplication,
  useAnswerApplicationAsk,
  useApplicationAsks,
  useApplyToJob,
  useAskAboutApplication,
  useJob,
  useJobCatalogue,
  useJobCount,
  useImportJobLink,
  useJobLinkPreview,
  useJobPicks,
  useJobs,
  useJobsByCompany,
  useSavedJobs,
  useSimilarJobs,
  useTodaysPicks,
  useUpdateApplicationStatus,
} from './useJobs';
export {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPrefs,
  useNotificationSettings,
  useNotifications,
  useRemoveNotification,
  useResetNotificationSettings,
  useSetNotificationPrefs,
  useSetNotificationSettings,
  useUnreadCount,
} from './useNotifications';
export { usePrivacySettings, useUpdatePrivacySettings } from './usePrivacy';
export {
  useAnswerGap,
  useCompleteNextStep,
  useDecideResumeSync,
  useGapQuestions,
  useProfile,
  useResumeSync,
  useUpdatePreferences,
} from './useProfile';
export {
  useApplyProfileDraft,
  useConfirmFacts,
  useRemoveCertification,
  useRemoveEducation,
  useRemoveExperience,
  useRemoveLink,
  useUpdateProfile,
  useUpdateSkills,
  useUpsertCertification,
  useUpsertEducation,
  useUpsertExperience,
  useUpsertLink,
} from './useProfileEntries';
export {
  useApplyAtsFix,
  useRegenerateSection,
  useResolveZeroCheck,
  useResumeContent,
  useFitToOnePage,
  useRewriteSection,
  useUpdateLetter,
  useUpdateResumeSection,
} from './useResumeContent';
export {
  isUnreadableFileError,
  useConfirmAccuracy,
  useExportResume,
  useImportResume,
  useShareLink,
} from './useResumeExports';
export { useResumePreview } from './useResumePreview';
export { useFetchLatestResumeDocument, useResumeDocument, useSaveResumeDocument, useSetResumeTemplate } from './useResumeDocument';
export {
  useCreateResume,
  useDeleteResume,
  useDuplicateResume,
  useRenameResume,
  useRestoreVersion,
  useResume,
  useResumeScore,
  useLineSources,
  useResumeVersions,
  useVersionChanges,
  useResumes,
  useSetResumeAsBase,
} from './useResumes';
export { useResetSession } from './useSession';
export { useFaq, useLegal, useSubmitTicket } from './useSupport';
export { applySaveToggle, useToggleSaveJob } from './useToggleSaveJob';
export { useCurrentUser, useDashboardStats, useSubscription } from './useUser';
