import Image from 'next/image'
import { MessageSquare, Code2, PenLine } from 'lucide-react'
import type { SessionSource } from '@/types/session'

export function getSourceIcon(source: SessionSource, size: number): React.ReactNode {
  switch (source) {
    case 'widget':
      return <MessageSquare size={size} />
    case 'slack':
      return <Image src="/logos/slack.svg" alt="Slack" width={size} height={size} />
    case 'intercom':
      return <Image src="/logos/intercom.svg" alt="Intercom" width={size} height={size} />
    case 'zendesk':
      return (
        <>
          <Image src="/logos/zendesk.svg" alt="Zendesk" width={size} height={size} className="dark:hidden" />
          <Image src="/logos/zendesk-dark.svg" alt="Zendesk" width={size} height={size} className="hidden dark:block" />
        </>
      )
    case 'gong':
      return <Image src="/logos/gong.svg" alt="Gong" width={size} height={size} />
    case 'fathom':
      return <Image src="/logos/fathom.svg" alt="Fathom" width={size} height={size} />
    case 'posthog':
      return <Image src="/logos/posthog.svg" alt="PostHog" width={size} height={size} />
    case 'api':
      return <Code2 size={size} />
    case 'manual':
      return <PenLine size={size} />
  }
}
