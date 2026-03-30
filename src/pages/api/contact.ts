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

  if (!nombre || !email || !mensaje || !asunto) {
    return res.status(400).json({ error: 'Nombre, email, asunto y mensaje son obligatorios.' });
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
        `Nombre: ${nombre}`,
        `Email: ${email}`,
        `Telefono: ${telefono || 'No indicado'}`,
        `Asunto: ${asunto}`,
        '',
        'Mensaje:',
        mensaje,
      ].join('\n'),
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefono:</strong> ${telefono || 'No indicado'}</p>
        <p><strong>Asunto:</strong> ${asunto}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${mensaje.replace(/\n/g, '<br/>')}</p>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: 'No se pudo enviar el correo de contacto.', detail });
  }
}
