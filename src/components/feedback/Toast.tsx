import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

export function Toast(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            'rounded-[var(--radius-md)] border border-border bg-surface text-text-primary shadow-[var(--shadow-sm)] font-sans',
          title: 'font-medium text-text-primary',
          description: 'text-text-secondary',
          actionButton:
            'bg-brand-navy text-white border border-brand-navy hover:bg-brand-navy-soft',
          cancelButton:
            'bg-surface text-text-primary border border-border hover:bg-surface-muted',
          closeButton:
            'border-border bg-surface text-text-secondary hover:bg-surface-muted hover:text-text-primary',
          success: 'border-success/30 bg-success/5',
          error: 'border-danger/30 bg-danger/5',
          warning: 'border-warning/30 bg-warning/5',
          info: 'border-brand-cyan/30 bg-brand-cyan/5',
        },
      }}
      {...props}
    />
  )
}

export { toast } from 'sonner'
