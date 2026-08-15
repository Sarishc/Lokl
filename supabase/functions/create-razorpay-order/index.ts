import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// Scaffold only: no current client route invokes this function.
serve(async (request) => {
  const { amount, receipt } = await request.json();
  const key = Deno.env.get('RAZORPAY_KEY_ID');
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');

  if (!key || !secret) {
    return new Response(JSON.stringify({ error: 'Missing Razorpay credentials' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${key}:${secret}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount, currency: 'INR', receipt }),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), { status: response.status, headers: { 'Content-Type': 'application/json' } });
});
