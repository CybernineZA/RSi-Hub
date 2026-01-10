import Link from 'next/link'
import * as React from 'react'

export function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ')
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-neutral-800/80 bg-neutral-950/60 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/40 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6', className)} {...props} />
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-neutral-800 bg-neutral-950/60 px-2.5 py-1 text-xs text-neutral-200',
        className
      )}
      {...props}
    />
  )
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'outline' | 'ghost' | 'danger' }
) {
  const v = props.variant ?? 'solid'
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-lime-300/30 disabled:opacity-60 disabled:cursor-not-allowed'
  const solid =
    'bg-lime-300 text-black hover:bg-lime-200 shadow-[0_8px_30px_rgba(163,230,53,0.18)]'
  const outline =
    'border border-neutral-800 bg-neutral-950/40 text-neutral-100 hover:bg-neutral-900/60'
  const ghost = 'text-neutral-200 hover:bg-neutral-900/60'
  const danger = 'border border-red-900/60 bg-red-950/40 text-red-100 hover:bg-red-950/70'
  const cls = cn(
    base,
    v === 'solid' ? solid : v === 'outline' ? outline : v === 'danger' ? danger : ghost,
    props.className
  )
  const { variant, ...rest } = props as any
  return <button {...rest} className={cls} />
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20',
        props.className
      )}
    />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20',
        props.className
      )}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20',
        props.className
      )}
    />
  )
}

export function A({
  href,
  children,
  className = '',
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'text-lime-200 hover:text-lime-100 underline underline-offset-4 decoration-lime-200/40 hover:decoration-lime-200/80',
        className
      )}
    >
      {children}
    </Link>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-neutral-800/70', className)} />
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className={cn('w-full overflow-auto rounded-2xl border border-neutral-800', className)}>
      <table className="min-w-full text-sm" {...props} />
    </div>
  )
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left font-medium text-neutral-300 bg-neutral-950/60 border-b border-neutral-800',
        className
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 border-b border-neutral-900 text-neutral-200', className)} {...props} />
}
