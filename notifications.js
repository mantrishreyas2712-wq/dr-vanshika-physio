const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // or use 'host' and 'port' for other providers
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendAppointmentEmail(appointment, type) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('[EMAIL] Credentials missing, skipping email.');
        return false;
    }

    const subject = type === 'new'
        ? 'Appointment Confirmation - Dr. Vanshika Physiotherapy'
        : 'Appointment Update - Dr. Vanshika Physiotherapy';

    const text = `Dear ${appointment.patient_name},

${type === 'new' ? 'Your appointment has been successfully booked.' : 'Your appointment details have been updated.'}

Details:
Date: ${appointment.date}
Time: ${appointment.time}
Service: ${appointment.service}

Location: Hadapsar Physiotherapy Clinic / Medizen Clinic
Dr. Vanshika Naik

If you have any questions, please reply to this email.`;

    try {
        console.log(`[EMAIL] Sending ${type} email to ${appointment.email}`);
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: appointment.email,
            subject: subject,
            text: text
        });
        console.log('[EMAIL] Sent successfully');
        return true;
    } catch (error) {
        console.error('[EMAIL] Error sending email:', error);
        return false;
    }
}

async function sendWhatsAppNotification(appointment, type) {
    // WhatsApp integration skipped for Free Tier stability.
    // Placeholder for future Twilio integration.
    console.log(`[WHATSAPP] Skipped notification for ${appointment.patient_name} (Email preferred).`);
    return true;
}

module.exports = {
    sendAppointmentEmail,
    sendWhatsAppNotification
};
