const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
  static getInstance() {
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_TRFJ7gXnnDU8Kc';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'fplhAqMGvcz1Flct82zdtr1B';

    return new Razorpay({
      key_id,
      key_secret
    });
  }

  /**
   * Create an order in Razorpay
   * @param {number} amountInRupees - Amount in INR
   * @param {string} receipt - Receipt / Booking ID reference
   * @param {object} notes - Additional metadata
   */
  static async createOrder({ amountInRupees, receipt, notes = {} }) {
    try {
      const razorpay = this.getInstance();
      const amountInPaise = Math.round(Number(amountInRupees) * 100);

      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: receipt ? receipt.toString().substring(0, 40) : `rec_${Date.now()}`,
        notes: {
          platform: 'UberClone',
          ...notes
        }
      };

      const order = await razorpay.orders.create(options);

      return {
        success: true,
        orderId: order.id,
        amount: order.amount,
        amountInRupees: amountInRupees,
        currency: order.currency,
        receipt: order.receipt,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TRFJ7gXnnDU8Kc'
      };
    } catch (error) {
      console.error('Razorpay createOrder error:', error);
      throw new Error(`Razorpay Order Creation Failed: ${error.message}`);
    }
  }

  /**
   * Verify Razorpay Payment Signature (HMAC-SHA256)
   * @param {string} orderId - Razorpay Order ID (order_xxxxx)
   * @param {string} paymentId - Razorpay Payment ID (pay_xxxxx)
   * @param {string} signature - Razorpay Signature from frontend callback
   */
  static verifyPaymentSignature({ orderId, paymentId, signature }) {
    try {
      const key_secret = process.env.RAZORPAY_KEY_SECRET || 'fplhAqMGvcz1Flct82zdtr1B';
      const body = `${orderId}|${paymentId}`;

      const expectedSignature = crypto
        .createHmac('sha256', key_secret)
        .update(body.toString())
        .digest('hex');

      const isValid = expectedSignature === signature;
      return {
        isValid,
        orderId,
        paymentId
      };
    } catch (error) {
      console.error('Razorpay signature verification error:', error);
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Verify Webhook Signature
   */
  static verifyWebhookSignature({ rawBody, signature, secret }) {
    try {
      const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Fetch payment details directly from Razorpay
   */
  static async fetchPayment(paymentId) {
    try {
      const razorpay = this.getInstance();
      return await razorpay.payments.fetch(paymentId);
    } catch (error) {
      console.error('Razorpay fetchPayment error:', error);
      throw error;
    }
  }
}

module.exports = RazorpayService;
