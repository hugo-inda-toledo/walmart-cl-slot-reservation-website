import axe from "axe-core";

/**
 * Ejecuta las reglas de accesibilidad de componentes. El contraste se revisa
 * en E2E, donde los estilos finales están disponibles para axe.
 */
export async function expectNoAxeViolations(
  container: Element = document.body,
): Promise<void> {
  const result = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  if (result.violations.length === 0) return;
  const details = result.violations
    .map(
      ({ id, nodes }) => `${id}: ${nodes.map((node) => node.html).join(", ")}`,
    )
    .join("\n");
  throw new Error(`Se encontraron infracciones de axe:\n${details}`);
}
