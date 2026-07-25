import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'
import { cn } from '@/lib/classNames'

export type TableProps = HTMLAttributes<HTMLTableElement>

export function Table({ className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-sm)]">
      <table className={cn('w-full min-w-full border-collapse text-sm', className)} {...props} />
    </div>
  )
}

export type TableHeadProps = HTMLAttributes<HTMLTableSectionElement>

export function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <thead
      className={cn('border-b border-border bg-surface-muted/80', className)}
      {...props}
    />
  )
}

export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>

export function TableBody({ className, ...props }: TableBodyProps) {
  return <tbody className={cn('divide-y divide-border bg-surface', className)} {...props} />
}

export type TableRowProps = HTMLAttributes<HTMLTableRowElement>

export function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn('transition-colors hover:bg-brand-cyan/[0.04]', className)}
      {...props}
    />
  )
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  header?: false
}

export type TableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & {
  header: true
}

export function TableCell({
  className,
  header,
  ...props
}: TableCellProps | TableHeaderCellProps) {
  if (header) {
    return (
      <th
        scope="col"
        className={cn(
          'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary',
          className,
        )}
        {...props}
      />
    )
  }

  return (
    <td className={cn('px-4 py-3 text-text-primary', className)} {...props} />
  )
}
