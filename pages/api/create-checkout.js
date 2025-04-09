import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';

// Inicializar Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Inicializar Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware para CORS
const corsMiddleware = cors({
  origin: true,
  methods: ['POST', 'OPTIONS', 'GET'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  console.log('Request received:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Applying CORS middleware...');
    // Aplicar CORS
    await runMiddleware(req, res, corsMiddleware);
    console.log('CORS middleware applied successfully');

    const { priceId, userId } = req.body;

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: 'https://bloopi.vercel.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://bloopi.vercel.app/cancel',
      client_reference_id: userId,
    });

    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ message: error.message });
  }
}
