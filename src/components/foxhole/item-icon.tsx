'use client'

import * as React from 'react'
import { cn } from '@/components/ui'

function buildCandidateUrls(imgName: string) {
  const clean = imgName.trim()

  // FoxholeLogi currently serves a bunch of assets under /assets/images.
  // We try a few likely paths/extensions.
  const asWebp = clean.replace(/\.png$/i, '.webp')
  const asPng = clean

  return [
    `https://foxholelogi.com/assets/images/items/${asWebp}`,
    `https://foxholelogi.com/assets/images/items/${asPng}`,
    `https://foxholelogi.com/assets/images/${asWebp}`,
    `https://foxholelogi.com/assets/images/${asPng}`,
  ]
}

export function ItemIcon({
  imgName,
  alt,
  className,
}: {
  imgName?: string | null
  alt: string
  className?: string
}) {
  const [idx, setIdx] = React.useState(0)

  const urls = React.useMemo(() => {
    if (!imgName) return [] as string[]
    return buildCandidateUrls(imgName)
  }, [imgName])

  const src = urls[idx]

  if (!src) {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-xl border border-neutral-800 bg-neutral-950/40 text-[10px] text-neutral-400',
          className
        )}
        aria-hidden
      >
        {alt.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn('rounded-xl border border-neutral-800 bg-neutral-950/40 object-contain', className)}
      loading="lazy"
      onError={() => {
        // try next candidate
        if (idx < urls.length - 1) setIdx(idx + 1)
        else setIdx(urls.length) // fallback placeholder
      }}
    />
  )
}
