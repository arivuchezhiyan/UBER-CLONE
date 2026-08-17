const FareRule = require('../models/FareRule');
const FareModifier = require('../models/FareModifier');

class FareCalculator {
  /**
   * Default fallback rules if DB rule is not configured yet
   */
  static getDefaultRule(vehicleCategory = 'UberGo', distanceType = 'SHORT') {
    const defaults = {
      'UberGo':    { baseFare: 50, perKmRate: 12, perMinuteRate: 1.5, minimumFare: 60, commissionPercentage: 20 },
      'Premier':   { baseFare: 70, perKmRate: 15, perMinuteRate: 2.0, minimumFare: 90, commissionPercentage: 20 },
      'UberXL':    { baseFare: 100, perKmRate: 18, perMinuteRate: 2.5, minimumFare: 130, commissionPercentage: 20 },
      'Uber Auto': { baseFare: 25, perKmRate: 8, perMinuteRate: 1.0, minimumFare: 30, commissionPercentage: 15 },
      'Uber Moto': { baseFare: 15, perKmRate: 5, perMinuteRate: 0.8, minimumFare: 20, commissionPercentage: 15 },
      'Sedan':     { baseFare: 50, perKmRate: 12, perMinuteRate: 1.5, minimumFare: 60, commissionPercentage: 20 },
      'SUV':       { baseFare: 100, perKmRate: 18, perMinuteRate: 2.5, minimumFare: 130, commissionPercentage: 20 },
      'Auto':      { baseFare: 25, perKmRate: 8, perMinuteRate: 1.0, minimumFare: 30, commissionPercentage: 15 },
      'Bike':      { baseFare: 15, perKmRate: 5, perMinuteRate: 0.8, minimumFare: 20, commissionPercentage: 15 }
    };

    const config = defaults[vehicleCategory] || defaults['UberGo'];
    return {
      vehicleCategory,
      distanceType,
      baseFare: config.baseFare,
      perKmRate: config.perKmRate,
      perMinuteRate: config.perMinuteRate,
      minimumFare: config.minimumFare,
      minDistanceKm: 0,
      waitingChargePerMin: 2.0,
      freeWaitingMin: 3,
      scheduledRideFee: distanceType === 'SCHEDULED' ? 50 : 0,
      commissionPercentage: config.commissionPercentage,
      taxPercentage: 5.0,
      longDistanceThresholdKm: 50
    };
  }

  /**
   * Calculate complete fare breakdown
   */
  static async calculateFare({
    vehicleCategory = 'UberGo',
    distanceKm = 5,
    durationMin = 15,
    waitingTimeMin = 0,
    tollAmount = 0,
    parkingAmount = 0,
    isScheduled = false,
    promoDiscount = 0,
    promoCode = null
  }) {
    const distanceType = distanceKm >= 50 ? 'LONG' : 'SHORT';
    
    // 1. Fetch Fare Rule from DB or fallback
    let rule = null;
    try {
      rule = await FareRule.findOne({ vehicleCategory, distanceType, isActive: true });
    } catch (e) {
      console.warn('FareRule fetch error, using fallback:', e.message);
    }
    if (!rule) {
      rule = this.getDefaultRule(vehicleCategory, distanceType);
    }

    // 2. Fetch Active Fare Modifiers (Surge, Rain, Night)
    let surgeMultiplier = 1.0;
    try {
      const activeModifiers = await FareModifier.find({
        isActive: true,
        $or: [{ appliesToCategory: null }, { appliesToCategory: vehicleCategory }]
      });

      for (const mod of activeModifiers) {
        if (mod.multiplier && mod.multiplier > surgeMultiplier) {
          surgeMultiplier = mod.multiplier;
        }
      }
    } catch (e) {
      console.warn('FareModifier fetch error:', e.message);
    }

    // 3. Base calculations
    const baseFare = Number(rule.baseFare) || 50;
    const distanceFare = Math.max(0, (Number(distanceKm) - (rule.minDistanceKm || 0))) * (Number(rule.perKmRate) || 12);
    const timeFare = (Number(durationMin) || 0) * (Number(rule.perMinuteRate) || 1.5);
    
    // 4. Waiting charges
    const extraWaitingMin = Math.max(0, (Number(waitingTimeMin) || 0) - (rule.freeWaitingMin || 3));
    const waitingCharge = extraWaitingMin * (Number(rule.waitingChargePerMin) || 2.0);

    // 5. Additional charges
    const tollCharge = Number(tollAmount) || 0;
    const parkingCharge = Number(parkingAmount) || 0;
    const scheduledFee = isScheduled ? (Number(rule.scheduledRideFee) || 30) : 0;

    // 6. Subtotal & Minimum Fare Check
    let rawSubtotal = baseFare + distanceFare + timeFare + waitingCharge + scheduledFee;
    if (rawSubtotal < (rule.minimumFare || 0)) {
      rawSubtotal = rule.minimumFare;
    }

    // Apply surge to core travel charges
    const subtotal = Math.round((rawSubtotal * surgeMultiplier) + tollCharge + parkingCharge);

    // 7. Taxes (5% GST)
    const taxPercentage = Number(rule.taxPercentage) || 5.0;
    const taxAmount = Math.round(subtotal * (taxPercentage / 100));

    // 8. Discount
    const discountAmount = Math.min(Number(promoDiscount) || 0, subtotal);

    // 9. Total Fare to Customer
    const totalFare = Math.max(0, subtotal + taxAmount - discountAmount);

    // 10. Platform Commission (20% on fare excluding tolls/parking/tax)
    const commissionPercentage = Number(rule.commissionPercentage) || 20.0;
    const commissionBase = Math.max(0, subtotal - tollCharge - parkingCharge);
    const platformCommission = Math.round(commissionBase * (commissionPercentage / 100));

    // Commission GST (18% on platform fee)
    const commissionGstPct = 18.0;
    const commissionGstAmount = Math.round(platformCommission * (commissionGstPct / 100));

    // 11. Driver Earnings (Total Fare - Platform Commission - Commission GST + Pass-throughs)
    const driverEarnings = Math.max(0, totalFare - platformCommission - commissionGstAmount);

    return {
      baseFare: Math.round(baseFare),
      distanceFare: Math.round(distanceFare),
      timeFare: Math.round(timeFare),
      waitingCharge: Math.round(waitingCharge),
      tollCharge,
      parkingCharge,
      scheduledFee,
      surgeMultiplier,
      subtotal,
      taxPercentage,
      taxAmount,
      discountAmount,
      promoCode,
      totalFare,
      commissionPercentage,
      platformCommission,
      driverEarnings,
      commissionGstPct,
      commissionGstAmount,
      fareRuleSnapshot: {
        vehicleCategory,
        distanceType,
        baseFare: rule.baseFare,
        perKmRate: rule.perKmRate,
        perMinuteRate: rule.perMinuteRate,
        minimumFare: rule.minimumFare,
        commissionPercentage: rule.commissionPercentage,
        taxPercentage: rule.taxPercentage
      }
    };
  }
}

module.exports = FareCalculator;
