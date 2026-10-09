"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_NAV = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/dashboard/analytics", label: "Analíticas" },
  { href: "/dashboard/bookings", label: "Reservas" },
  { href: "/dashboard/orders", label: "Pagos" },
  { href: "/dashboard/clients", label: "Clientes" },
  { href: "/dashboard/conversations", label: "Conversaciones" },
  { href: "/dashboard/assistant", label: "Asistente" },
  { href: "/dashboard/availability", label: "Disponibilidad" },
  { href: "/dashboard/services", label: "Servicios y precios" },
  { href: "/dashboard/portfolio", label: "Trabajos" },
  { href: "/dashboard/achievements", label: "Logros" },
  { href: "/dashboard/testimonials", label: "Testimonios" },
  { href: "/dashboard/knowledge", label: "Preguntas frecuentes" },
  { href: "/dashboard/settings", label: "Contacto y reglas" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Panel" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ADMIN_NAV.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2.5 text-sm transition-colors ${
              active ? "bg-key text-bone" : "text-bone/70 hover:bg-white/5 hover:text-bone"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
