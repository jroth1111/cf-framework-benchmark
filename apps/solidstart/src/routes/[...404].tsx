import { HttpStatusCode } from "@solidjs/start";

export default function NotFoundPage() {
  return (
    <main class="container" style="padding: 32px 0;">
      <HttpStatusCode code={404} />
      <h1 class="h1">Page Not Found</h1>
      <p class="muted">The benchmark route you requested does not exist.</p>
      <a class="pill" href="/">Return home</a>
    </main>
  );
}
