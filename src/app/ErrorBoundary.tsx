import { Component, type ReactNode } from "react";

import { Button, StatusMessage } from "@/shared/ui";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  public render() {
    if (this.state.failed)
      return (
        <main>
          <StatusMessage tone="error">
            <p>Ocurrió un problema inesperado. Inténtalo nuevamente.</p>
            <Button
              onClick={() => {
                window.location.reload();
              }}
            >
              Recargar
            </Button>
          </StatusMessage>
        </main>
      );
    return this.props.children;
  }
}
