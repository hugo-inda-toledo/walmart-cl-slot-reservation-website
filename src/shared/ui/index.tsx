import {
  createContext,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import "./tokens.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly busy?: boolean;
}

export function Button({
  busy = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`ui-button ${props.className ?? ""}`.trim()}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      type={props.type ?? "button"}
    >
      {busy ? <Spinner label="Cargando…" /> : null}
      {children}
    </button>
  );
}

export function Spinner({ label = "Cargando…" }: { readonly label?: string }) {
  return (
    <span className="ui-spinner">
      <span aria-hidden="true">◌</span>
      <span className="ui-visually-hidden">{label}</span>
    </span>
  );
}

export interface RadioCardOption<T extends string> {
  readonly value: T;
  readonly disabled: boolean;
  readonly accessibleLabel: string;
}

export interface RadioCardGroupProps<T extends string> {
  readonly label: string;
  readonly orientation: "horizontal" | "vertical";
  readonly options: readonly RadioCardOption<T>[];
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly renderOption: (
    option: RadioCardOption<T>,
    state: { readonly checked: boolean },
  ) => ReactNode;
}

export function RadioCardGroup<T extends string>({
  label,
  orientation,
  options,
  value,
  onChange,
  renderOption,
}: RadioCardGroupProps<T>) {
  const labelId = useId();
  const optionRefs = useRef(new Map<T, HTMLButtonElement>());
  const enabledOptions = options.filter((option) => !option.disabled);
  const selectedValue = enabledOptions.some((option) => option.value === value)
    ? value
    : null;
  const fallbackValue = selectedValue ?? enabledOptions[0]?.value ?? null;
  const [focusedValue, setFocusedValue] = useState<T | null>(fallbackValue);
  const previousValueRef = useRef<T | null>(value);

  useEffect(() => {
    const focusedOption = enabledOptions.find(
      (option) => option.value === focusedValue,
    );
    if (previousValueRef.current !== value || !focusedOption) {
      setFocusedValue(fallbackValue);
    }
    previousValueRef.current = value;
  }, [enabledOptions, fallbackValue, focusedValue, value]);

  const focusOption = (nextValue: T) => {
    setFocusedValue(nextValue);
    optionRefs.current.get(nextValue)?.focus();
  };

  const moveFocus = (currentValue: T, direction: 1 | -1) => {
    const currentIndex = enabledOptions.findIndex(
      (option) => option.value === currentValue,
    );
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + enabledOptions.length) %
          enabledOptions.length;
    const nextOption = enabledOptions[nextIndex];
    if (nextOption) focusOption(nextOption.value);
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    option: RadioCardOption<T>,
  ) => {
    if (option.disabled) {
      event.preventDefault();
      return;
    }

    const isPreviousKey =
      (orientation === "horizontal" && event.key === "ArrowLeft") ||
      (orientation === "vertical" && event.key === "ArrowUp");
    const isNextKey =
      (orientation === "horizontal" && event.key === "ArrowRight") ||
      (orientation === "vertical" && event.key === "ArrowDown");

    if (isPreviousKey) {
      event.preventDefault();
      moveFocus(option.value, -1);
    } else if (isNextKey) {
      event.preventDefault();
      moveFocus(option.value, 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const firstOption = enabledOptions[0];
      if (firstOption) focusOption(firstOption.value);
    } else if (event.key === "End") {
      event.preventDefault();
      const lastOption = enabledOptions.at(-1);
      if (lastOption) focusOption(lastOption.value);
    } else if (
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space"
    ) {
      event.preventDefault();
      onChange(option.value);
    }
  };

  return (
    <div
      className={`ui-radio-card-group ui-radio-card-group--${orientation}`}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-orientation={orientation}
    >
      <span id={labelId} className="ui-visually-hidden">
        {label}
      </span>
      {options.map((option) => {
        const checked = option.value === value && !option.disabled;
        const tabIndex =
          !option.disabled && option.value === focusedValue ? 0 : -1;
        return (
          <button
            key={option.value}
            ref={(element) => {
              if (element) optionRefs.current.set(option.value, element);
              else optionRefs.current.delete(option.value);
            }}
            className="ui-radio-card"
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={option.disabled || undefined}
            aria-label={option.accessibleLabel}
            tabIndex={tabIndex}
            onClick={() => {
              if (!option.disabled) onChange(option.value);
            }}
            onMouseDown={(event) => {
              if (option.disabled) event.preventDefault();
            }}
            onFocus={() => {
              if (!option.disabled) setFocusedValue(option.value);
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, option);
            }}
          >
            {renderOption(option, { checked })}
          </button>
        );
      })}
    </div>
  );
}

export interface StatusMessageProps extends HTMLAttributes<HTMLDivElement> {
  readonly tone: "error" | "notice";
  readonly supportCode?: string;
}

export function StatusMessage({
  tone,
  supportCode,
  children,
  className,
  ...props
}: StatusMessageProps) {
  return (
    <div
      {...props}
      className={`ui-status ui-status--${tone} ${className ?? ""}`.trim()}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
      {supportCode ? <p>Código de soporte: {supportCode}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  readonly title: string;
  readonly children?: ReactNode;
}) {
  return (
    <section className="ui-empty-state" aria-labelledby="empty-state-title">
      <h2 id="empty-state-title">{title}</h2>
      {children ? <p>{children}</p> : null}
    </section>
  );
}

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly dismissible?: boolean;
  readonly closeLabel?: string;
}

type NativeDialog = HTMLDialogElement & {
  showModal?: () => void;
  close?: () => void;
};

export function Dialog({
  open,
  title,
  children,
  onClose,
  dismissible = true,
  closeLabel = "Cerrar diálogo",
}: DialogProps) {
  const dialogRef = useRef<NativeDialog>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (typeof dialog.showModal === "function" && !dialog.open)
        dialog.showModal();
      else dialog.setAttribute("open", "");
      dialog.focus();
      return () => {
        if (openerRef.current?.isConnected) openerRef.current.focus();
      };
    }

    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    openerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const close = () => {
      if (!open) return;
      if (dismissible) {
        onClose();
      } else {
        if (typeof dialog.showModal === "function" && !dialog.open)
          dialog.showModal();
        else dialog.setAttribute("open", "");
        dialog.focus();
      }
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (dismissible) onClose();
      } else if (event.key === "Tab") {
        const controls = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 && !element.closest("[hidden], [inert]"),
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus();
        } else if (document.activeElement === dialog) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const cancel = (event: Event) => {
      event.preventDefault();
      if (dismissible) onClose();
    };
    dialog.addEventListener("close", close);
    dialog.addEventListener("keydown", keyDown);
    dialog.addEventListener("cancel", cancel);
    if (open && !dismissible) dialog.focus();
    return () => {
      dialog.removeEventListener("close", close);
      dialog.removeEventListener("keydown", keyDown);
      dialog.removeEventListener("cancel", cancel);
    };
  }, [dismissible, onClose, open]);

  return (
    <dialog
      ref={dialogRef}
      className="ui-dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <h2 id={titleId}>{title}</h2>
      {dismissible ? (
        <Button
          className="ui-button--secondary ui-dialog__close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </Button>
      ) : null}
      {children}
    </dialog>
  );
}

type Politeness = "polite" | "assertive";
type Announce = (message: string, politeness?: Politeness) => void;
const AnnouncerContext = createContext<Announce | null>(null);

export function LiveAnnouncerProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [announcement, setAnnouncement] = useState({
    message: "",
    politeness: "polite" as Politeness,
  });
  const announce = useCallback<Announce>((message, politeness = "polite") => {
    setAnnouncement({ message, politeness });
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div
        className="ui-visually-hidden"
        aria-live={announcement.politeness}
        aria-atomic="true"
      >
        {announcement.message}
      </div>
    </AnnouncerContext.Provider>
  );
}

// This hook is intentionally exported together with the provider for ergonomic shared UI imports.
// eslint-disable-next-line react-refresh/only-export-components
export function useAnnounce(): Announce {
  const announce = useContext(AnnouncerContext);
  if (!announce) throw new Error("useAnnounce requiere LiveAnnouncerProvider");
  return announce;
}
