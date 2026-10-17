import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { ReactNode } from 'react';

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
      {children}
      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

/** Stripe ids are rendered monospace and link straight to the Stripe dashboard */
export function StripeIdLink({ id, href }: { id: string; href: string }) {
  return (
    <ExternalLink href={href}>
      <span className="font-mono text-xs">{id}</span>
    </ExternalLink>
  );
}
