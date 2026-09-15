"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the console for now; a dedicated logging
    // integration belongs to a later task.
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <div>
        <h1>Something went wrong</h1>
        <button onClick={() => reset()}>Try again</button>
      </div>
    </main>
  );
}
