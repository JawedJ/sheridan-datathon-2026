import Engine from "@/components/Engine";

export default function Home() {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>How long would their savings last?</h1>
        <p style={{ color: "var(--text-2)", margin: "4px 0 0" }}>
          Pick any of 4,500 real bank customers, hit them with a shock, and get a plan from their own numbers.
        </p>
      </div>
      <Engine />
    </>
  );
}
