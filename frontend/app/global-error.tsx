"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "Arial, sans-serif",
          padding: "3rem",
          textAlign: "center",
        }}
      >
        <h1>Unable to open your workspace</h1>
        <p>The service may be temporarily unavailable. Try again shortly.</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
