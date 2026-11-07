import Engine from "@/components/Engine";

export default function Home() {
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>How long would their savings last?</h1>
        <p style={{ color: "var(--text-2)", margin: "4px 0 0" }}>
          4,500 real bank customers. Describe a shock in plain words, see how long their savings last, and get a plan from their own numbers.
        </p>
      </div>
      <Engine />
    </>
  );
}
