/**
 * INITIAL DATA ONLY — seeded into KnowledgeEntry, then edited in /dashboard/knowledge.
 *
 * Rule: entries never repeat prices, turnaround days or other numbers that
 * already live in Service or business rules. The assistant reads those from
 * its tools, so changing a price in one place updates every answer.
 * Entries marked TODO need YM Freak's real answer before launch; they are
 * seeded inactive so the assistant never uses a placeholder.
 */
export interface KnowledgeSeed {
  key: string;
  kind: "FAQ" | "POLICY" | "PROCESS";
  questionEs: string;
  questionEn: string;
  answerEs: string;
  answerEn: string;
  tags: string[];
  active: boolean;
}

export const knowledgeSeeds: KnowledgeSeed[] = [
  {
    key: "payment-split",
    kind: "POLICY",
    questionEs: "¿Cómo se paga un proyecto?",
    questionEn: "How do I pay for a project?",
    answerEs:
      "Pagas el 50 % para reservar tu fecha y el 50 % restante cuando el trabajo está listo. Los archivos finales se entregan una vez completado el pago. Los pagos se hacen por PayPal.",
    answerEn:
      "You pay 50% to book your date and the remaining 50% when the work is ready. Final files are released once the balance is paid. Payments are made through PayPal.",
    tags: ["pago", "payment", "deposito", "deposit", "paypal"],
    active: true,
  },
  {
    key: "revisions",
    kind: "POLICY",
    questionEs: "¿Cuántas revisiones incluye?",
    questionEn: "How many revisions are included?",
    answerEs:
      "Cada canción incluye revisiones sin costo (el número exacto aparece en cada servicio). A partir de ahí, cada revisión adicional tiene un costo fijo que se suma a tu pedido.",
    answerEn:
      "Each song includes free revisions (the exact number is listed on each service). After that, each extra revision has a fixed fee added to your order.",
    tags: ["revisiones", "revisions", "cambios", "changes"],
    active: true,
  },
  {
    key: "cancellation",
    kind: "POLICY",
    questionEs: "¿Puedo cancelar?",
    questionEn: "Can I cancel?",
    answerEs:
      "Sí. Tienes 24 horas desde que pagas el depósito para cancelar y recibir el reembolso completo. Pasado ese plazo, escríbele directamente a YM Freak.",
    answerEn:
      "Yes. You have 24 hours from paying the deposit to cancel and get a full refund. After that, contact YM Freak directly.",
    tags: ["cancelar", "cancel", "reembolso", "refund"],
    active: true,
  },
  {
    key: "turnaround",
    kind: "PROCESS",
    questionEs: "¿Cuánto tarda?",
    questionEn: "How long does it take?",
    answerEs:
      "Cada servicio tiene un tiempo de entrega en días laborables (lunes a viernes). Si combinas servicios para la misma canción, por ejemplo pista + mezcla y mastering, los días se suman. La fecha exacta depende del calendario y se calcula al momento de reservar.",
    answerEn:
      "Each service has a turnaround in working days (Monday to Friday). If you combine services for the same song, such as beat + mixing and mastering, the days add up. The exact date depends on the calendar and is calculated when you book.",
    tags: ["tiempo", "entrega", "turnaround", "delivery"],
    active: true,
  },
  {
    key: "sessions-remote",
    kind: "PROCESS",
    questionEs: "¿Las sesiones son presenciales?",
    questionEn: "Are sessions in person?",
    answerEs:
      "La asesoría para productores y la grabación de voces son sesiones remotas por videollamada, por hora, de lunes a viernes entre 8:00 a.m. y 6:00 p.m. (hora de República Dominicana).",
    answerEn:
      "Producer coaching and vocal recording are remote sessions over video call, billed per hour, Monday to Friday between 8:00 a.m. and 6:00 p.m. (Dominican Republic time).",
    tags: ["sesion", "session", "videollamada", "video call", "remoto", "remote"],
    active: true,
  },
  {
    key: "ads",
    kind: "FAQ",
    questionEs: "¿Qué es el servicio de Publicidad / Ads?",
    questionEn: "What is the Audio ads service?",
    answerEs:
      "Creación de anuncios de audio por encargo para empresas y marcas, para radio o redes sociales. Se entrega como trabajo terminado.",
    answerEn:
      "Commissioned audio ads for businesses and brands, for radio or social media, delivered as a finished piece.",
    tags: ["ads", "anuncio", "publicidad", "radio", "empresa", "business"],
    active: true,
  },
  {
    key: "send-files",
    kind: "PROCESS",
    questionEs: "¿Cómo envío mis archivos?",
    questionEn: "How do I send my files?",
    answerEs: "TODO: YM Freak debe definir cómo recibe stems y archivos (formato, plataforma).",
    answerEn: "TODO: YM Freak must define how stems and files are received (format, platform).",
    tags: ["archivos", "files", "stems"],
    active: false,
  },
];
