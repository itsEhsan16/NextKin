import type { CareerDocument, CertificateDetails } from '@nextkin/shared/models';
import Image from 'next/image';

import { formatShortDate } from '@/lib/format';
import { resolveDrawing, resolveImageSrc, resolveLogo } from '@/ui/assets';

import { FORMAT_LABEL } from '../documentLibrary';
import { FileTypeTile } from './FileTypeTile';

/**
 * What the detail card shows under its actions. The board opens a certificate and draws it
 * (286:2251), so a certificate is drawn from what it says. An image shows itself. Anything else
 * is a file the card can't draw, and it says so rather than faking a page.
 */
export function DocumentPreview({ document }: { document: CareerDocument }) {
  if (document.certificate) return <CertificateSheet certificate={document.certificate} />;

  const image = resolveImageSrc(document.imageUrl);
  if (image) {
    return (
      <div className="flex justify-center rounded-md bg-neutral-50 px-6 py-10">
        {/* The one photo is George's 49px avatar, so it is shown at its own size, not blown up. */}
        <Image
          src={image}
          alt={document.title}
          width={64}
          height={64}
          className="size-16 rounded-md object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-md bg-neutral-50 px-6 py-10 text-center">
      <FileTypeTile format={document.format} size="preview" />
      <p className="mt-1 text-title-l text-text-primary">No preview for this file</p>
      <p className="max-w-xs text-body-s text-text-secondary">
        {FORMAT_LABEL[document.format]} files open in their own viewer. Use Open to see the whole
        document.
      </p>
    </div>
  );
}

/** The certificate as drawn: issuer, credential, recipient, statement, date and signature. */
export function CertificateSheet({ certificate }: { certificate: CertificateDetails }) {
  const renderLogo = resolveLogo(certificate.issuerLogoUrl);
  const { signer } = certificate;
  const renderSignature = resolveDrawing(signer?.signatureUrl);

  return (
    <div className="relative rounded-md bg-neutral-50 px-8 pb-7 pt-7 text-center">
      {/* The inset rule the board frames the certificate with (286:2293). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-sm border border-border-default"
      />

      {renderLogo?.({ className: 'mx-auto size-10' })}
      <p className="mt-3 text-body-m text-text-secondary">{certificate.issuer}</p>
      <p className="mt-2 text-h1 text-text-primary">{certificate.title}</p>
      <p className="mt-2 border-b border-border-default pb-3 text-h2 text-text-primary">
        {certificate.recipient}
      </p>
      <p className="mt-3 text-body-s text-text-secondary">{certificate.statement}</p>

      <div className="mt-6 flex items-end justify-between gap-4 text-left">
        <div>
          <p className="text-body-m font-semibold text-text-primary">
            {formatShortDate(certificate.completedAt)}
          </p>
          <p className="mt-0.5 text-micro text-neutral-400">Date of completion</p>
        </div>
        {signer && (
          <div className="flex flex-col items-end text-right">
            {renderSignature?.({ className: 'h-[29px] w-[88px]' })}
            <p className="mt-1.5 text-body-m font-semibold text-text-primary">{signer.name}</p>
            <p className="mt-0.5 text-micro text-neutral-400">{signer.role}</p>
          </div>
        )}
      </div>
    </div>
  );
}
