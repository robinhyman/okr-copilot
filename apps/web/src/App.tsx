export function App() {
  return (
    <main className="container">
      <h1>OKR Co-Pilot</h1>
      <p>MVP starter shell (workflow-first, LLM-second).</p>

      <section>
        <h2>Current decisions locked</h2>
        <ul>
          <li>Reminder channel priority: WhatsApp</li>
          <li>First KR integration: Excel workbook</li>
          <li>Data residency target: UK/EU</li>
          <li>Local-first dev/testing required</li>
        </ul>
      </section>

      <section>
        <h2>Backend quick links</h2>
        <ul>
          <li><a href="http://localhost:4000/health" target="_blank">/health</a></li>
          <li><a href="http://localhost:4000/modules" target="_blank">/modules</a></li>
        </ul>
      </section>

      <p className="todo">TODO-B3: Replace shell with real workspace + OKR draft/editor flow.</p>
    </main>
  );
}
