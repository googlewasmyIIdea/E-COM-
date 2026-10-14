import { Search } from "lucide-react";
export default function SearchBar() {
  return (
    <form
      role="search"
      action="/shop"
      className="flex min-w-0 flex-1 items-center rounded-xl border border-forest/20 bg-white shadow-sm"
    >
      <label htmlFor="store-search" className="sr-only">
        Search stationery
      </label>
      <input
        id="store-search"
        type="search"
        name="q"
        placeholder="Search pens, journals, art supplies…"
        className="h-11 w-full min-w-0 rounded-l-xl bg-transparent px-4 text-sm outline-offset-0"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex size-11 shrink-0 items-center justify-center rounded-r-xl bg-forest text-white hover:bg-forest/90"
      >
        <Search size={19} />
      </button>
    </form>
  );
}
