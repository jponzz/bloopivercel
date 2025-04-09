import { buffer } from 'micro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Deshabilitar el bodyParser para el webhook
export const config = {
  api: {
    bodyParser: false,
  },
};

// Inicializar Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Inicializar Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  try {
    // Verificar evento
    const event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Manejar el evento
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Obtener detalles de la suscripción
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      
      // Obtener detalles del método de pago
      const paymentMethod = await stripe.paymentMethods.retrieve(
        subscription.default_payment_method
      );

      // Preparar datos para Supabase
      const subscriptionData = {
        user_id: session.client_reference_id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: session.customer,
        price_id: subscription.items.data[0].price.id,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        plan_id: subscription.items.data[0].plan.id,
        payment_method_brand: paymentMethod.card.brand,
        payment_method_last4: paymentMethod.card.last4,
        payment_method_exp_month: paymentMethod.card.exp_month,
        payment_method_exp_year: paymentMethod.card.exp_year
      };

      // Guardar en Supabase
      const { error } = await supabase
        .from('subscriptions')
        .insert(subscriptionData);

      if (error) {
        console.error('Error saving to Supabase:', error);
        throw error;
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ message: error.message });
  }
}
