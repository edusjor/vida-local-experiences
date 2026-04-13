import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

type ContactPayload = {
  nombre?: string;
  telefono?: string;
  asunto?: string;
  email?: string;
  mensaje?: string;
};

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const body = (req.body || {}) as ContactPayload;
  const nombre = normalize(body.nombre);
  const telefono = normalize(body.telefono);
  const asunto = normalize(body.asunto) || 'Consulta general';
  const email = normalize(body.email);
  const mensaje = normalize(body.mensaje);

  if (!nombre || !email || !telefono || !mensaje || !asunto) {
    return res.status(400).json({ error: 'Nombre, email, telefono y mensaje son obligatorios.' });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;
  const toEmail = process.env.CONTACT_TO_EMAIL || 'atencionalcliente@guapileslineatours.com';

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom || !Number.isFinite(smtpPort)) {
    return res.status(500).json({
      error: 'Falta configurar SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y SMTP_FROM en variables de entorno.',
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: toEmail,
      replyTo: email,
      subject: `[Contacto Web] ${asunto}`,
      text: [
        'Nuevo mensaje de contacto (sitio web)',
        '',
        `Nombre: ${nombre}`,
        `Correo: ${email}`,
        `Telefono: ${telefono}`,
        `Asunto: ${asunto}`,
        '',
        'Mensaje:',
        mensaje,
        '',
        'Responder directamente a este correo usara Reply-To del cliente.',
      ].join('\n'),
      html: `
        <div style="margin:0;padding:24px;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;margin:0 auto;border-collapse:collapse;">
            <tr>
              <td style="background:linear-gradient(135deg,#065f46 0%,#0f766e 100%);padding:22px 24px;border-radius:14px 14px 0 0;">
                <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#d1fae5;">Formulario Web</p>
                <h2 style="margin:0;font-size:24px;line-height:1.2;color:#ffffff;">Nuevo mensaje de contacto</h2>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:22px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
                  <tr>
                    <td style="width:130px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Nombre</td>
                    <td style="font-size:15px;color:#0f172a;">${nombre}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Correo</td>
                    <td style="font-size:15px;color:#0f172a;"><a href="mailto:${email}" style="color:#0369a1;text-decoration:none;">${email}</a></td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Telefono</td>
                    <td style="font-size:15px;color:#0f172a;"><a href="tel:${telefono.replace(/\s+/g, '')}" style="color:#0369a1;text-decoration:none;">${telefono}</a></td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Asunto</td>
                    <td style="font-size:15px;color:#0f172a;">${asunto}</td>
                  </tr>
                </table>

                <div style="margin-top:14px;border:1px solid #dbeafe;background:#f8fafc;border-radius:12px;padding:14px 16px;">
                  <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#475569;">Mensaje</p>
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;white-space:normal;">${mensaje.replace(/\n/g, '<br/>')}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:0 24px 22px 24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;">
                <div style="margin-top:8px;border-top:1px solid #e2e8f0;padding-top:12px;">
                  <p style="margin:0;font-size:12px;color:#64748b;">
                    Tip: puedes responder este correo y llegara directamente al cliente (Reply-To: ${email}).
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </div>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: 'No se pudo enviar el correo de contacto.', detail });
  }
}
