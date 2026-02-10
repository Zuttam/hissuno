import { Button } from './button'

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
}

export function FilterChip({ label, active, onClick, icon }: FilterChipProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      selected={active}
      onClick={onClick}
      className="!rounded-full !px-2.5 !py-0.5 !text-[10px]"
    >
      {icon && <span className="mr-0.5 inline-flex items-center">{icon}</span>}
      {label}
    </Button>
  )
}
