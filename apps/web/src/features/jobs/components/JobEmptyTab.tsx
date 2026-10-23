import { StateView } from '@/ui/StateView';

/** Benefits/Reviews — no field for either exists anywhere in the data model (not just undrawn
    on this board), so this renders the same honest "nothing here" primitive mobile's own
    spec-derived Company/Match-Criteria screens use rather than fabricated content. */
export function JobEmptyTab({ title, message }: { title: string; message: string }) {
  return <StateView title={title} message={message} className="py-8" />;
}
