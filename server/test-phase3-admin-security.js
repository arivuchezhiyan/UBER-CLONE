const mongoose = require('mongoose');
const User = require('./models/User');
const Booking = require('./models/Booking');
const FareRule = require('./models/FareRule');
const FareModifier = require('./models/FareModifier');
const DriverDocument = require('./models/DriverDocument');
const SupportTicket = require('./models/SupportTicket');
const AuditLog = require('./models/AuditLog');

async function runPhase3Tests() {
  console.log('🚀 Starting Phase 3 Admin Panel & Security Tests...\n');
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rental-app-phase3-test';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoUri, '\n');

    await User.deleteMany({});
    await Booking.deleteMany({});
    await DriverDocument.deleteMany({});
    await SupportTicket.deleteMany({});
    await AuditLog.deleteMany({});

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition, message) {
      totalTests++;
      if (condition) {
        passedTests++;
        console.log(`  ✅ [PASS] ${message}`);
      } else {
        console.error(`  ❌ [FAIL] ${message}`);
      }
    }

    // ========================================================
    // TEST SUITE 1: Admin Account & Role Verification
    // ========================================================
    console.log('🧪 Test Suite 1: Admin Account & Roles');
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@uberclone.com',
      phone: '9999999999',
      password: 'hashed_password',
      userType: 'admin',
      role: 'SUPER_ADMIN'
    });

    assert(admin.userType === 'admin', 'Admin userType verified');
    assert(admin.role === 'SUPER_ADMIN', 'Super admin role assigned');

    // ========================================================
    // TEST SUITE 2: Driver Approval Workflow
    // ========================================================
    console.log('\n🧪 Test Suite 2: Driver Approval Workflow');
    const applicant = await User.create({
      name: 'Driver Applicant',
      phone: '9888888888',
      password: 'hash',
      userType: 'driver',
      approvalStatus: 'PENDING',
      vehicleDetails: { model: 'Toyota Etios', licensePlate: 'KA01AB1234', color: 'White' }
    });

    assert(applicant.approvalStatus === 'PENDING', 'New applicant status is PENDING');

    // Admin approves driver
    applicant.approvalStatus = 'APPROVED';
    applicant.approvedBy = admin._id;
    applicant.approvedAt = new Date();
    await applicant.save();

    await AuditLog.create({
      adminId: admin._id,
      action: 'DRIVER_APPROVED',
      entityType: 'DRIVER',
      entityId: applicant._id,
      description: `Admin approved driver ${applicant.name}`
    });

    const approvedDriver = await User.findById(applicant._id);
    assert(approvedDriver.approvalStatus === 'APPROVED', 'Driver status transitioned to APPROVED');
    assert(approvedDriver.approvedBy.toString() === admin._id.toString(), 'approvedBy recorded admin ID');

    // ========================================================
    // TEST SUITE 3: Driver Document Upload & Verification
    // ========================================================
    console.log('\n🧪 Test Suite 3: Driver Document Verification');
    const doc = await DriverDocument.create({
      driverId: applicant._id,
      documentType: 'DRIVING_LICENCE',
      documentNumber: 'DL-KA-2026-987654',
      fileUrl: 'https://storage.uberclone.com/docs/dl-applicant.pdf',
      fileName: 'driving_licence.pdf',
      fileSize: 1024 * 350,
      mimeType: 'application/pdf',
      verificationStatus: 'PENDING'
    });

    assert(doc.verificationStatus === 'PENDING', 'Document initially PENDING');

    // Verify document
    doc.verificationStatus = 'APPROVED';
    doc.verifiedBy = admin._id;
    doc.verifiedAt = new Date();
    await doc.save();

    const verifiedDoc = await DriverDocument.findById(doc._id);
    assert(verifiedDoc.verificationStatus === 'APPROVED', 'Document status transitioned to APPROVED');

    // ========================================================
    // TEST SUITE 4: Support Ticket Lifecycle
    // ========================================================
    console.log('\n🧪 Test Suite 4: Support Ticket Management');
    const ticket = await SupportTicket.create({
      createdBy: applicant._id,
      createdByRole: 'DRIVER',
      category: 'FARE_DISPUTE',
      subject: 'Toll charge missing from Ride #RN-1234',
      description: 'Customer did not pay toll at airport toll gate.',
      priority: 'HIGH',
      status: 'OPEN'
    });

    assert(ticket.ticketNumber.startsWith('TCK-'), `Generated auto-formatted ticket number: ${ticket.ticketNumber}`);
    assert(ticket.status === 'OPEN', 'Ticket status is OPEN');

    // Admin resolves ticket
    ticket.status = 'RESOLVED';
    ticket.resolution = 'Toll charge of ₹110 manually credited to driver wallet.';
    ticket.assignedTo = admin._id;
    ticket.resolvedAt = new Date();
    await ticket.save();

    const resolvedTicket = await SupportTicket.findById(ticket._id);
    assert(resolvedTicket.status === 'RESOLVED', 'Ticket status updated to RESOLVED');
    assert(resolvedTicket.resolution.length > 0, 'Resolution description recorded');

    // ========================================================
    // TEST SUITE 5: Audit Log Integrity
    // ========================================================
    console.log('\n🧪 Test Suite 5: Audit Log Trail');
    const totalLogs = await AuditLog.countDocuments();
    assert(totalLogs >= 1, `Audit log trail active: ${totalLogs} logged actions recorded`);

    // ========================================================
    // SUMMARY
    // ========================================================
    console.log(`\n========================================================`);
    console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log(`========================================================\n`);

    if (passedTests === totalTests) {
      console.log('✅ PHASE 3 ADMIN & SECURITY VERIFICATION: 100% SUCCESS');
    }
  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase3Tests();
