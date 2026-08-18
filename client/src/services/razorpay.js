import { createRazorpayOrder, verifyRazorpayPayment, getRazorpayConfig } from './api';

/**
 * Dynamically load Razorpay Checkout Script
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Launch Razorpay Payment Modal
 * @param {object} params
 * @param {string} params.bookingId - Associated booking ID
 * @param {number} params.amount - Amount in INR
 * @param {string} params.purpose - 'RIDE_PAYMENT' or 'WALLET_TOPUP'
 * @param {object} params.customer - User details (name, phone, email)
 * @param {function} params.onSuccess - Callback on verified payment
 * @param {function} params.onFailure - Callback on error
 */
export const processRazorpayPayment = async ({
  bookingId = null,
  amount,
  purpose = 'RIDE_PAYMENT',
  customer = {},
  onSuccess,
  onFailure
}) => {
  try {
    // 1. Ensure Razorpay SDK is loaded
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
    }

    // 2. Fetch public key configuration if needed
    let keyId = process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_TRFJ7gXnnDU8Kc';
    try {
      const configRes = await getRazorpayConfig();
      if (configRes.data?.keyId) {
        keyId = configRes.data.keyId;
      }
    } catch (e) {
      console.warn('Using local fallback Razorpay key');
    }

    // 3. Create Order on Backend
    const orderRes = await createRazorpayOrder({
      bookingId,
      amount,
      purpose
    });

    if (!orderRes.data?.success) {
      throw new Error(orderRes.data?.message || 'Failed to initialize payment order');
    }

    const { orderId, amount: amountInPaise } = orderRes.data;

    // 4. Configure Razorpay Options
    const options = {
      key: keyId,
      amount: amountInPaise,
      currency: 'INR',
      name: 'UberClone',
      description: purpose === 'WALLET_TOPUP' ? 'Wallet Balance Top-Up' : `Payment for Ride #${bookingId || ''}`,
      image: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
      order_id: orderId,
      prefill: {
        name: customer.name || 'Customer',
        email: customer.email || 'customer@uberclone.com',
        contact: customer.phone || '+919999999999'
      },
      notes: {
        bookingId: bookingId || '',
        purpose
      },
      theme: {
        color: '#000000'
      },
      handler: async function (response) {
        try {
          // 5. Send Payment Signature to Backend for Verification
          const verifyRes = await verifyRazorpayPayment({
            bookingId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            purpose,
            amount
          });

          if (verifyRes.data?.success) {
            if (onSuccess) {
              onSuccess({
                verified: true,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                amount
              });
            }
          } else {
            throw new Error(verifyRes.data?.message || 'Payment verification failed');
          }
        } catch (verifyErr) {
          console.error('Payment verification failed:', verifyErr);
          if (onFailure) onFailure(verifyErr);
        }
      },
      modal: {
        ondismiss: function () {
          console.log('Payment modal dismissed by user');
          if (onFailure) onFailure(new Error('Payment window closed by user'));
        }
      }
    };

    // 6. Open Razorpay Modal
    const razorpayModal = new window.Razorpay(options);
    razorpayModal.open();
  } catch (error) {
    console.error('Razorpay payment error:', error);
    if (onFailure) onFailure(error);
  }
};
