'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { showToast } from '@/lib/toast';

import { adminButton } from './adminButton';

/**
 * Setting up an authenticator (toreview §171.13): the QR code an authenticator app scans, and the
 * same secret as text for an app that can't scan. Used by the first sign-in and by Settings ›
 * Replace authenticator. The QR is drawn here from the otpauth link; the secret never leaves the
 * page.
 */
export function AuthenticatorQr({ otpauthUrl, secret }: { otpauthUrl: string; secret: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void QRCode.toString(otpauthUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then((markup) => live && setSvg(markup))
      .catch(() => live && setSvg(null));
    return () => {
      live = false;
    };
  }, [otpauthUrl]);

  const grouped = secret.replace(/(.{4})/g, '$1 ').trim();
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        role="img"
        aria-label="QR code for your authenticator app"
        className="size-44 rounded-md border border-neutral-200 bg-white p-3 [&_svg]:size-full"
        // The markup is the qrcode library's own SVG of the otpauth link: no user input in it.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <div className="flex w-full flex-col items-center gap-1.5">
        <p className="text-body-s text-text-secondary">Can’t scan it? Enter this key instead:</p>
        <div className="flex items-center gap-2">
          <code className="rounded-sm bg-neutral-50 px-2 py-1 font-mono text-body-s tracking-[0.04em] text-text-primary">
            {grouped}
          </code>
          <button
            type="button"
            aria-label="Copy the key"
            onClick={() =>
              void navigator.clipboard?.writeText(secret).then(() => showToast('Key copied'))
            }
            className={cn(adminButton.small, 'px-2')}
          >
            <AdminIcon name="Copy01" size="sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Backup codes, shown once: ten codes in two columns and a copy button. */
export function BackupCodeList({ codes }: { codes: string[] }) {
  return (
    <div className="flex w-full flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-4">
        {codes.map((code) => (
          <li key={code} className="font-mono text-body-m tracking-[0.04em] text-text-primary">
            {code}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard
            ?.writeText(codes.join('\n'))
            .then(() => showToast('Backup codes copied'))
        }
        className={adminButton.secondary}
      >
        <AdminIcon name="Copy01" />
        Copy codes
      </button>
    </div>
  );
}
