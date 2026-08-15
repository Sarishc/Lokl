import { createHmac } from 'node:crypto';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// Scaffold only: no current client route invokes this function.
serve(async (request) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');

  if (!secret) {
    return new Response(JSON.stringify({ verified: false, error: 'Missing Razorpay secret' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const generated = createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return new Response(JSON.stringify({ verified: generated === razorpay_signature }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
