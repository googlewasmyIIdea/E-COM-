"use client";
import { useState } from "react";
import { request } from "@/features/commerce/client";
import { message } from "@/lib/utils";
export default function ReportReview({ id }: { id: string }) {
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  async function report() {
    setPending(true);
    try {
      await request(`catalog/reviews/${id}/report`, { method: "POST" });
      setNotice("Reported for moderation.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="mt-3">
      <button
        onClick={report}
        disabled={pending || notice === "Reported for moderation."}
        className="text-[10px] text-ink/70 underline"
      >
        Report review
      </button>
      {notice && (
        <p role="status" className="mt-2 text-xs text-ink/70">
          {notice}
        </p>
      )}
    </div>
  );
}
