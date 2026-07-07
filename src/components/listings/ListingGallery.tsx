'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ListingGallery({ images, title }: { images: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-dugout/10 text-dugout/30">
        <Package size={64} />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg">
      <div className="grid gap-1">
        <div className="relative aspect-[4/3] rounded-lg border border-scoreboard/15 bg-dugout/10">
          <Image
            src={images[activeIndex]}
            alt={title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-contain"
            priority
          />
        </div>
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-1">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={cn(
                  'relative aspect-square overflow-hidden rounded-sm border border-scoreboard/15',
                  i === activeIndex && 'ring-2 ring-clay ring-inset'
                )}
              >
                <Image src={img} alt="" fill sizes="120px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
