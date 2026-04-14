import nodemailer from 'nodemailer';
import { prisma } from './prisma';
import { getOnvoPaymentIntent } from './onvo';
import { getReservationCheckoutDetailsById } from './reservationDetails';
import { siteConfig } from './siteConfig';

function envOrFallback(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

const APPROVED_PAYMENT_STATUSES = new Set(['succeeded', 'paid', 'approved']);
const DEFAULT_RESERVATION_ADMIN_EMAIL = siteConfig.supportEmail;
const SUPPORT_EMAIL = envOrFallback(process.env.CONTACT_TO_EMAIL, siteConfig.supportEmail);
const SUPPORT_WHATSAPP = envOrFallback(process.env.BUSINESS_WHATSAPP, siteConfig.whatsappDisplay);
const SUPPORT_LOCATION = envOrFallback(process.env.BUSINESS_LOCATION, siteConfig.location);
const BRAND_NAME = siteConfig.brandName;

type FinalizeReservationResult =
  | { ok: true; alreadyPaid: boolean; message: string }
  | { ok: false; status: number; pending?: boolean; error: string; message?: string };

function formatDateEs(date: Date): string {
  const day = new Intl.DateTimeFormat('es-CR', { day: 'numeric', timeZone: 'UTC' }).format(date);
  const month = new Intl.DateTimeFormat('es-CR', { month: 'long', timeZone: 'UTC' }).format(date);
  const year = new Intl.DateTimeFormat('es-CR', { year: 'numeric', timeZone: 'UTC' }).format(date);
  return `${day} ${month}, ${year}`;
}

function formatUsd(value: number | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'N/D';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

async function sendReservationConfirmationEmail(input: {
  reservationId: number;
  customerEmail: string;
  customerName: string;
  tourTitle: string;
  people: number;
  date: Date;
  scheduleTime: string | null;
  paymentMethod: string | null;
  hotel: string | null;
  packageTitle: string | null;
  totalAmount: number | null;
  priceBreakdown: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;
  const notifyTo = process.env.RESERVATION_TO_EMAIL || process.env.CONTACT_TO_EMAIL || DEFAULT_RESERVATION_ADMIN_EMAIL;

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom || !Number.isFinite(smtpPort)) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const dateText = formatDateEs(input.date);
  const timeText = input.scheduleTime?.trim() || 'Por coordinar';
  const paymentMethodText = String(input.paymentMethod ?? '').trim() || 'No indicado';
  const hotelText = String(input.hotel ?? '').trim() || 'No indicado';
  const packageTitleText = String(input.packageTitle ?? '').trim() || 'No indicado';
  const hasBreakdown = input.priceBreakdown.length > 0;
  const totalAmountText = formatUsd(input.totalAmount);
  const priceBreakdownText = hasBreakdown
    ? input.priceBreakdown.map((item) => `- ${item.name}: ${item.quantity}`).join('\n')
    : '- No detallado';
  const priceBreakdownHtml = hasBreakdown
    ? input.priceBreakdown.map((item) => `<li><strong>${item.name}:</strong> ${item.quantity}</li>`).join('')
    : '<li>No detallado</li>';
  const subject = `Reserva confirmada #${input.reservationId} - ${input.tourTitle}`;
  const text = [
    `Hola ${input.customerName},`,
    '',
    'Tu pago fue aprobado y tu reserva quedo confirmada.',
    '',
    'Resumen de compra:',
    `Reserva: #${input.reservationId}`,
    `Tour: ${input.tourTitle}`,
    `Fecha: ${dateText}`,
    `Horario: ${timeText}`,
    `Personas: ${input.people}`,
    `Total pagado: ${totalAmountText}`,
    `Paquete: ${packageTitleText}`,
    `Detalle de seleccion:\n${priceBreakdownText}`,
    `Hospedaje: ${hotelText}`,
    `Metodo de pago: ${paymentMethodText}`,
    '',
    'Si necesitas ayuda, contactanos:',
    `Correo: ${SUPPORT_EMAIL}`,
    `WhatsApp: ${SUPPORT_WHATSAPP}`,
    `Ubicacion: ${SUPPORT_LOCATION}`,
    '',
    `Gracias por confiar en ${BRAND_NAME}.`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#12171e;padding:24px;color:#f8fafc;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f2f1f,#1c5b38);padding:22px 24px;color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">${BRAND_NAME}</p>
          <h2 style="margin:8px 0 0;font-size:28px;line-height:1.2;">Reserva confirmada</h2>
        </div>

        <div style="padding:22px 24px;">
          <p style="margin:0 0 12px;font-size:15px;">Hola <strong>${input.customerName}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#334155;">Tu pago fue aprobado y tu reserva quedo confirmada. Aqui tienes el resumen de tu compra:</p>

          <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <tbody>
              <tr><td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;width:42%;">Reserva</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">#${input.reservationId}</td></tr>
              <tr><td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;">Tour</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${input.tourTitle}</td></tr>
              <tr><td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;">Fecha</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${dateText}</td></tr>
              <tr><td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;">Horario</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${timeText}</td></tr>
              <tr><td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;">Personas</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${input.people}</td></tr>
              <tr><td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;">Total pagado</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${totalAmountText}</td></tr>
              <tr><td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;">Paquete</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${packageTitleText}</td></tr>
              <tr><td style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;">Hospedaje</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${hotelText}</td></tr>
              <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:700;">Metodo de pago</td><td style="padding:10px 12px;">${paymentMethodText}</td></tr>
            </tbody>
          </table>

          <div style="margin-top:12px;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a;">Seleccion de personas / tarifas</p>
            <ul style="margin:0;padding-left:18px;color:#334155;font-size:14px;">
              ${priceBreakdownHtml}
            </ul>
          </div>

          <div style="margin-top:16px;padding:14px;border:1px solid #f6c26a;background:#fff7e8;border-radius:10px;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#7a5419;">Atencion al cliente</p>
            <p style="margin:0;font-size:14px;color:#0f172a;"><strong>Correo:</strong> ${SUPPORT_EMAIL}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#0f172a;"><strong>WhatsApp:</strong> ${SUPPORT_WHATSAPP}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#0f172a;"><strong>Ubicacion:</strong> ${SUPPORT_LOCATION}</p>
          </div>

          <p style="margin:16px 0 0;font-size:14px;color:#334155;">Gracias por confiar en ${BRAND_NAME}.</p>
        </div>
      </div>
    </div>
  `;

  const recipients = Array.from(new Set([input.customerEmail, notifyTo].map((item) => String(item ?? '').trim()).filter(Boolean)));
  await transporter.sendMail({
    from: smtpFrom,
    to: recipients,
    subject,
    text,
    html,
  });
}

async function sendReservationPendingValidationEmail(input: {
  reservationId: number;
  customerEmail: string;
  customerName: string;
  tourTitle: string;
  people: number;
  date: Date;
  scheduleTime: string | null;
  paymentMethod: string | null;
  hotel: string | null;
  packageTitle: string | null;
  totalAmount: number | null;
  priceBreakdown: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;
  const notifyTo = process.env.RESERVATION_TO_EMAIL || process.env.CONTACT_TO_EMAIL || DEFAULT_RESERVATION_ADMIN_EMAIL;

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom || !Number.isFinite(smtpPort)) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const dateText = formatDateEs(input.date);
  const timeText = input.scheduleTime?.trim() || 'Por coordinar';
  const paymentMethodText = String(input.paymentMethod ?? '').trim() || 'No indicado';
  const hotelText = String(input.hotel ?? '').trim() || 'No indicado';
  const packageTitleText = String(input.packageTitle ?? '').trim() || 'No indicado';
  const hasBreakdown = input.priceBreakdown.length > 0;
  const totalAmountText = formatUsd(input.totalAmount);
  const priceBreakdownText = hasBreakdown
    ? input.priceBreakdown.map((item) => `- ${item.name}: ${item.quantity}`).join('\n')
    : '- No detallado';
  const priceBreakdownHtml = hasBreakdown
    ? input.priceBreakdown.map((item) => `<li><strong>${item.name}:</strong> ${item.quantity}</li>`).join('')
    : '<li>No detallado</li>';
  const subject = `Reserva por confirmar #${input.reservationId} - ${input.tourTitle}`;
  const text = [
    `Hola ${input.customerName},`,
    '',
    'Recibimos tu solicitud de reserva y el comprobante SINPE.',
    'Estado actual: Pendiente por validar pago.',
    'Nuestro equipo revisara manualmente la transferencia y, una vez validada, te enviaremos un nuevo correo con tu reserva confirmada.',
    '',
    'Resumen de la solicitud:',
    `Reserva: #${input.reservationId}`,
    `Tour: ${input.tourTitle}`,
    `Fecha: ${dateText}`,
    `Horario: ${timeText}`,
    `Personas: ${input.people}`,
    `Total de la reserva: ${totalAmountText}`,
    `Paquete: ${packageTitleText}`,
    `Detalle de seleccion:\n${priceBreakdownText}`,
    `Hospedaje: ${hotelText}`,
    `Metodo de pago: ${paymentMethodText}`,
    `Estado: Pendiente por validar`,
    '',
    'Si necesitas ayuda, contactanos:',
    `Correo: ${SUPPORT_EMAIL}`,
    `WhatsApp: ${SUPPORT_WHATSAPP}`,
    `Ubicacion: ${SUPPORT_LOCATION}`,
    '',
    `Gracias por confiar en ${BRAND_NAME}.`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#12171e;padding:24px;color:#f8fafc;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#5c4115,#c98928);padding:22px 24px;color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">${BRAND_NAME}</p>
          <h2 style="margin:8px 0 0;font-size:28px;line-height:1.2;">Reserva por confirmar</h2>
        </div>

        <div style="padding:22px 24px;">
          <p style="margin:0 0 12px;font-size:15px;">Hola <strong>${input.customerName}</strong>,</p>
          <p style="margin:0 0 10px;font-size:15px;color:#334155;">Recibimos tu solicitud de reserva y el comprobante SINPE.</p>
          <p style="margin:0 0 16px;font-size:15px;color:#7c2d12;"><strong>Estado actual:</strong> Pendiente por validar pago.</p>
          <p style="margin:0 0 16px;font-size:14px;color:#334155;">Apenas validemos manualmente la transferencia, te enviaremos un nuevo correo con la confirmacion exitosa de tu reserva.</p>

          <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <tbody>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;width:42%;">Reserva</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">#${input.reservationId}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;">Tour</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${input.tourTitle}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;">Fecha</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${dateText}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;">Horario</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${timeText}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;">Personas</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${input.people}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;">Total de la reserva</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${totalAmountText}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;">Paquete</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${packageTitleText}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;">Hospedaje</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${hotelText}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;border-bottom:1px solid #e2e8f0;font-weight:700;">Metodo de pago</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${paymentMethodText}</td></tr>
              <tr><td style="padding:10px 12px;background:#fff7ed;font-weight:700;">Estado</td><td style="padding:10px 12px;color:#9a3412;font-weight:700;">Pendiente por validar</td></tr>
            </tbody>
          </table>

          <div style="margin-top:12px;padding:12px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#7c2d12;">Seleccion de personas / tarifas</p>
            <ul style="margin:0;padding-left:18px;color:#9a3412;font-size:14px;">
              ${priceBreakdownHtml}
            </ul>
          </div>

          <div style="margin-top:16px;padding:14px;border:1px solid #f6c26a;background:#fff7e8;border-radius:10px;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#7a5419;">Atencion al cliente</p>
            <p style="margin:0;font-size:14px;color:#0f172a;"><strong>Correo:</strong> ${SUPPORT_EMAIL}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#0f172a;"><strong>WhatsApp:</strong> ${SUPPORT_WHATSAPP}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#0f172a;"><strong>Ubicacion:</strong> ${SUPPORT_LOCATION}</p>
          </div>

          <p style="margin:16px 0 0;font-size:14px;color:#334155;">Gracias por confiar en ${BRAND_NAME}.</p>
        </div>
      </div>
    </div>
  `;

  const recipients = Array.from(new Set([input.customerEmail, notifyTo].map((item) => String(item ?? '').trim()).filter(Boolean)));
  await transporter.sendMail({
    from: smtpFrom,
    to: recipients,
    subject,
    text,
    html,
  });
}

export async function sendReservationConfirmationEmailByReservationId(reservationId: number): Promise<void> {
  const normalizedReservationId = Number(reservationId);
  if (!Number.isFinite(normalizedReservationId) || normalizedReservationId <= 0) return;

  const reservation = await prisma.reservation.findUnique({
    where: { id: normalizedReservationId },
    include: {
      tour: {
        select: { title: true },
      },
    },
  });

  if (!reservation || !reservation.email) return;

  const details = await getReservationCheckoutDetailsById(reservation.id);

  await sendReservationConfirmationEmail({
    reservationId: reservation.id,
    customerEmail: reservation.email,
    customerName: [reservation.name, reservation.lastName].filter(Boolean).join(' ').trim() || reservation.name,
    tourTitle: reservation.tour?.title || 'Tour',
    people: reservation.people,
    date: reservation.date,
    scheduleTime: reservation.scheduleTime,
    paymentMethod: reservation.paymentMethod,
    hotel: reservation.hotel,
    packageTitle: details.packageTitle,
    totalAmount: details.totalAmount,
    priceBreakdown: details.priceBreakdown,
  });
}

export async function sendReservationPendingValidationEmailByReservationId(reservationId: number): Promise<void> {
  const normalizedReservationId = Number(reservationId);
  if (!Number.isFinite(normalizedReservationId) || normalizedReservationId <= 0) return;

  const reservation = await prisma.reservation.findUnique({
    where: { id: normalizedReservationId },
    include: {
      tour: {
        select: { title: true },
      },
    },
  });

  if (!reservation || !reservation.email) return;

  const details = await getReservationCheckoutDetailsById(reservation.id);

  await sendReservationPendingValidationEmail({
    reservationId: reservation.id,
    customerEmail: reservation.email,
    customerName: [reservation.name, reservation.lastName].filter(Boolean).join(' ').trim() || reservation.name,
    tourTitle: reservation.tour?.title || 'Tour',
    people: reservation.people,
    date: reservation.date,
    scheduleTime: reservation.scheduleTime,
    paymentMethod: reservation.paymentMethod,
    hotel: reservation.hotel,
    packageTitle: details.packageTitle,
    totalAmount: details.totalAmount,
    priceBreakdown: details.priceBreakdown,
  });
}

export async function finalizeReservationPayment(input: {
  paymentIntentId: string;
  reservationId?: number;
}): Promise<FinalizeReservationResult> {
  const paymentIntentId = String(input.paymentIntentId ?? '').trim();
  const expectedReservationId = Number(input.reservationId);

  if (!paymentIntentId) {
    return { ok: false, status: 400, error: 'Datos de confirmacion invalidos' };
  }

  try {
    const paymentIntent = await getOnvoPaymentIntent(paymentIntentId);
    const normalizedPaymentStatus = String(paymentIntent.status ?? '').toLowerCase();

    if (!APPROVED_PAYMENT_STATUSES.has(normalizedPaymentStatus)) {
      return {
        ok: false,
        status: 202,
        pending: true,
        error: 'Pago pendiente de confirmacion',
        message: 'Pago recibido, en espera de confirmacion final.',
      };
    }

    const metadataReservationId = Number(paymentIntent.metadata?.reservationId ?? '');
    if (!Number.isFinite(metadataReservationId) || metadataReservationId <= 0) {
      return { ok: false, status: 400, error: 'El pago no contiene una reserva valida asociada' };
    }

    if (Number.isFinite(expectedReservationId) && expectedReservationId > 0 && metadataReservationId !== expectedReservationId) {
      return { ok: false, status: 400, error: 'El pago no coincide con la reserva indicada' };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: metadataReservationId },
        });

        if (!reservation) {
          return { ok: false as const, status: 404, error: 'Reserva no encontrada' };
        }

        if (reservation.paid) {
          return {
            ok: true as const,
            alreadyPaid: true,
            reservationId: reservation.id,
            sendEmail: false,
          };
        }

        const updatedReservation = await tx.reservation.update({
          where: { id: reservation.id },
          data: { paid: true },
        });

        return {
          ok: true as const,
          alreadyPaid: false,
          reservationId: updatedReservation.id,
          sendEmail: true,
        };
      },
      {
        isolationLevel: 'Serializable',
      },
    );

    if (!result.ok) {
      return { ok: false, status: result.status, error: result.error };
    }

    if (!result.alreadyPaid && result.sendEmail) {
      await sendReservationConfirmationEmailByReservationId(result.reservationId).catch(() => null);
    }

    return {
      ok: true,
      alreadyPaid: result.alreadyPaid,
      message: result.alreadyPaid
        ? 'La reserva ya estaba confirmada previamente.'
        : 'Pago validado y reserva confirmada.',
    };
  } catch {
    return { ok: false, status: 500, error: 'No se pudo confirmar el estado del pago' };
  }
}
