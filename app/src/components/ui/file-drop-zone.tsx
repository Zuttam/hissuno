'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/utils/class'

interface FileDropZoneProps {
  accept?: string
  onFileSelect: (file: File) => void
  label?: string
  description?: string
  className?: string
  disabled?: boolean
}

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[color:var(--text-tertiary)]"
    >
      <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

const FileDropZone = ({
  accept,
  onFileSelect,
  label = 'Select a file',
  description,
  className,
  disabled = false,
}: FileDropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (file) onFileSelect(file)
    },
    [disabled, onFileSelect]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFileSelect(file)
      // Reset so the same file can be selected again
      e.target.value = ''
    },
    [onFileSelect]
  )

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-3 rounded-[4px] border-2 border-dashed p-8 transition',
        isDragging
          ? 'border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)]/5'
          : 'border-[color:var(--border-subtle)] bg-[color:var(--surface)]',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <UploadIcon />
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-[color:var(--text-secondary)]">{label}</p>
        {description && (
          <p className="text-xs text-[color:var(--text-tertiary)]">{description}</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  )
}
FileDropZone.displayName = 'FileDropZone'

export { FileDropZone }
