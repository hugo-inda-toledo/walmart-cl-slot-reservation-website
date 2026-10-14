export default async function globalSetup(): Promise<void> {
  const apiUrl = process.env.E2E_API_URL ?? "http://localhost:8080";
  const response = await fetch(`${apiUrl}/api/v1/demo-addresses`).catch(
    () => null,
  );

  if (!response?.ok) {
    throw new Error(
      `No fue posible consultar ${apiUrl}/api/v1/demo-addresses. Levanta la API local con el perfil local antes de ejecutar npm run e2e.`,
    );
  }
}
