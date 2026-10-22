/**
 * A cover letter as it prints (EDIT 04's preview, 867:636; COVER 03's page): the name, contact
 * line and date, the greeting, the paragraphs, then the sign-off and the name under it.
 */

const dateLine = (at: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(at);

export function LetterPage({
  name,
  contact,
  date,
  greeting,
  paragraphs,
  signoff,
}: {
  name: string;
  contact: string;
  date: Date;
  greeting: string;
  paragraphs: string[];
  /** The closing line, then the name on the next ("Kind regards,\nGeorge Smith"). */
  signoff: string;
}) {
  return (
    <div className="flex flex-col gap-4 text-body-m leading-relaxed text-text-primary">
      <div>
        <p className="text-h2 font-bold">{name}</p>
        {contact && <p className="mt-2 text-caption-m text-text-tertiary">{contact}</p>}
        <p className="mt-2 text-caption-m text-text-tertiary">{dateLine(date)}</p>
      </div>
      <p className="font-semibold">{greeting || 'Dear Hiring Manager,'}</p>
      {paragraphs
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      <p className="whitespace-pre-line font-semibold">{signoff || 'Kind regards,'}</p>
    </div>
  );
}
