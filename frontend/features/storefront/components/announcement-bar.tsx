export default function AnnouncementBar({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="bg-forest px-4 py-2 text-center text-[10px] leading-4 text-white sm:text-xs">
      {text}
    </div>
  );
}
