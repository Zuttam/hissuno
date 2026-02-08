import { cn } from '@/lib/utils/class'
import { Button } from './button'

interface PaginationProps {
  currentPage: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

function Pagination({ currentPage, pageSize, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)

  if (totalPages <= 1) {
    return null
  }

  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, total)

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="font-mono text-xs text-[color:var(--text-secondary)]">
        Showing {from}-{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          &lsaquo;
        </Button>
        <span className="font-mono text-xs text-[color:var(--text-secondary)]">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          &rsaquo;
        </Button>
      </div>
    </div>
  )
}

export { Pagination }
