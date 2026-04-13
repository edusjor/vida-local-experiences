import type { NextApiRequest, NextApiResponse } from 'next';
import { finalizeReservationPayment } from '../../../lib/reservationPayment';

type OnvoWebhookBody = {
  type?: unknown;
  data?: {
    id?: unknown;
    paymentIntentId?: unknown;
  } | null;
};

function getWebhookSecretFromHeaders(req: NextApiRequest): string {
  const headerValue = req.headers['x-webhook-secret'];
  if (Array.isArray(headerValue)) return String(headerValue[0] ?? '').trim();
  return String(headerValue ?? '').trim();
}

function getPaymentIntentIdFromEvent(body: OnvoWebhookBody): string {
  const eventType = String(body.type ?? '').trim();
  if (eventType !== 'payment-intent.succeeded') return '';

  const source = body.data;
  if (!source || typeof source !== 'object') return '';

  const directId = String(source.id ?? '').trim();
  if (directId) return directId;

  const fallbackId = String(source.paymentIntentId ?? '').trim();
  if (fallbackId) return fallbackId;

  return '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const expectedWebhookSecret = String(process.env.ONVO_WEBHOOK_SECRET ?? '').trim();
  const webhookSecretFromRequest = getWebhookSecretFromHeaders(req);

  if (!expectedWebhookSecret) {
    return res.status(500).json({ error: 'Webhook de ONVO no configurado' });
  }

  if (!webhookSecretFromRequest || webhookSecretFromRequest !== expectedWebhookSecret) {
    return res.status(401).json({ error: 'Webhook no autorizado' });
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as OnvoWebhookBody;
  const paymentIntentId = getPaymentIntentIdFromEvent(body);
  if (!paymentIntentId) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const result = await finalizeReservationPayment({ paymentIntentId });
  if (!result.ok && result.pending) {
    return res.status(200).json({ ok: true, pending: true });
  }

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.status(200).json({ ok: true, message: result.message });
}
