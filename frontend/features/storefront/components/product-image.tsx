"use client";
import Image from "next/image";
import { useState } from "react";
export default function ProductImage({
  src,
  alt,
  sizes = "(max-width: 640px) 50vw, 25vw",
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={failed ? "/images/stationery-hero.webp" : src}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
