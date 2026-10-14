"use client";
import { useState } from "react";
import ProductImage from "./product-image";
export default function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [selected, setSelected] = useState(
    images[0] ?? "/images/stationery-hero.webp",
  );
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-lavender/20">
        <ProductImage
          src={selected}
          alt={name}
          sizes="(max-width: 768px) 90vw, 50vw"
          priority
        />
      </div>
      <div className="mt-4 flex gap-3">
        {images.map((src, i) => (
          <button
            key={`${src}-${i}`}
            aria-label={`View product image ${i + 1}`}
            aria-pressed={selected === src}
            onClick={() => setSelected(src)}
            className={`relative size-20 overflow-hidden rounded-xl border-2 ${selected === src ? "border-coral" : "border-transparent"}`}
          >
            <ProductImage
              src={src}
              alt={`${name} view ${i + 1}`}
              sizes="80px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
