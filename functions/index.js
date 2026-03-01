const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Use environment variables for any API keys/secrets (set via `firebase functions:config:set`)
// e.g. to configure SendGrid: `firebase functions:config:set sendgrid.api_key="YOUR_KEY"`
// to configure Twilio: `firebase functions:config:set twilio.sid="..." twilio.token="..." twilio.phone="..."`

// create reusable transporter object using nodemailer (SMTP) as example
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().gmail?.user,
    pass: functions.config().gmail?.pass,
  },
});

function sendEmail(to, subject, text) {
  if (!transporter) return Promise.resolve();
  const mailOptions = {
    from: functions.config().gmail?.user,
    to,
    subject,
    text,
  };
  return transporter.sendMail(mailOptions).catch(console.error);
}

function sendSms(phone, message) {
  // placeholder; integrate with Twilio or other SMS provider
  const twilioSid = functions.config().twilio?.sid;
  const twilioToken = functions.config().twilio?.token;
  const twilioPhone = functions.config().twilio?.phone;

  if (twilioSid && twilioToken && twilioPhone) {
    const client = require('twilio')(twilioSid, twilioToken);
    return client.messages.create({
      body: message,
      from: twilioPhone,
      to: phone,
    });
  } else {
    // no configuration, just log
    console.log('SMS to', phone, ':', message);
    return Promise.resolve();
  }
}

exports.onBookingCreated = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const booking = snap.data();
    // send notifications to user and worker
    const userMsg = `Your booking for ${booking.service} has been received and is pending confirmation.`;
    await sendEmail(booking.email, 'Booking Received', userMsg);
    await sendSms(booking.phone, userMsg);

    // optionally notify worker (if their contact info available)
    if (booking.workerPhone) {
      const workerMsg = `New booking request for ${booking.service} from ${booking.name}.`;
      await sendSms(booking.workerPhone, workerMsg);
    }

    return null;
  });

exports.onBookingStatusChange = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status !== after.status) {
      const msg = `Your booking status changed from ${before.status} to ${after.status}.`;
      await sendEmail(after.email, 'Booking Status Updated', msg);
      await sendSms(after.phone, msg);
    }
    return null;
  });
