import Image from 'next/image'
import { getIntegrationType } from './integration-registry'

interface IntegrationIconProps {
  type: string
  size?: number
}

function WidgetSvgIcon({ size }: { size: number }) {
  return (
    <svg className="flex-shrink-0" width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  )
}

export function IntegrationIcon({ type, size = 24 }: IntegrationIconProps) {
  const integration = getIntegrationType(type)
  if (!integration) return null

  if (integration.inlineSvg) {
    return <WidgetSvgIcon size={size} />
  }

  if (integration.iconDarkSrc) {
    return (
      <>
        <Image src={integration.iconSrc} alt={integration.name} width={size} height={size} className="flex-shrink-0 dark:hidden" />
        <Image src={integration.iconDarkSrc} alt={integration.name} width={size} height={size} className="hidden flex-shrink-0 dark:block" />
      </>
    )
  }

  return (
    <Image
      src={integration.iconSrc}
      alt={integration.name}
      width={size}
      height={size}
      className={`flex-shrink-0 ${integration.invertInDark ? 'dark:invert' : ''}`}
    />
  )
}
