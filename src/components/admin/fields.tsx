import type { ReactNode } from "react";

const input =
  "w-full rounded-md border border-rule bg-studio-deep px-3 py-2.5 text-[0.95rem] text-bone placeholder:text-ash/60 " +
  "focus:border-bone/60 focus:outline-none";

function Label({ name, label, hint, children }: { name: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-bone/90">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ash">{hint}</p>}
    </div>
  );
}

export function TextField({
  name,
  label,
  defaultValue,
  hint,
  type = "text",
  placeholder,
  inputMode,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  hint?: ReactNode;
  type?: "text" | "email" | "url" | "time" | "date" | "password";
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "tel" | "email" | "url";
}) {
  return (
    <Label name={name} label={label} hint={hint}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        inputMode={inputMode}
        className={input}
      />
    </Label>
  );
}

export function TextArea({
  name,
  label,
  defaultValue,
  hint,
  rows = 4,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: ReactNode;
  rows?: number;
}) {
  return (
    <Label name={name} label={label} hint={hint}>
      <textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? ""} className={`${input} leading-relaxed`} />
    </Label>
  );
}

export function Select({
  name,
  label,
  defaultValue,
  options,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  hint?: ReactNode;
}) {
  return (
    <Label name={name} label={label} hint={hint}>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} className={input}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Label>
  );
}

export function Checkbox({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-4 accent-[#ebe6dc]" />
      <span>
        <span className="text-[0.95rem]">{label}</span>
        {hint && <span className="block text-xs text-ash">{hint}</span>}
      </span>
    </label>
  );
}

/** Two columns on wide screens (Spanish | English), one on phones. */
export function Pair({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 md:grid-cols-2">{children}</div>;
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-5 rounded-lg border border-rule p-5 sm:p-6">
      <legend className="px-2 text-sm text-ash">{title}</legend>
      {children}
    </fieldset>
  );
}
