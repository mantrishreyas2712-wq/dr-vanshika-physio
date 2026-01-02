const express = require('express');
const router = express.Router();
const db = require('../database');
const { sendAppointmentEmail, sendWhatsAppNotification } = require('../notifications');
const { verifyToken } = require('./auth');

// Get all appointments (admin only)
router.get('/', verifyToken, async (req, res) => {
    try {
        const appointments = await db.getAllAppointments();
        res.json(appointments);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ message: 'Failed to fetch appointments' });
    }
});

// Create new appointment
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, date, time, service, notes } = req.body;

        // Validation
        if (!name || !email || !phone || !date || !time || !service) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const appointment = await db.createAppointment({
            patient_name: name,
            email,
            phone,
            date,
            time,
            service,
            notes: notes || ''
        });

        // Send notifications
        try {
            await sendAppointmentEmail(appointment, 'new');
            await sendWhatsAppNotification(appointment, 'new');
        } catch (notifError) {
            console.error('Notification error:', notifError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            message: 'Appointment booked successfully',
            appointment
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ message: 'Failed to book appointment' });
    }
});

// Update appointment status (admin only)
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const appointment = await db.getAppointmentById(id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        await db.updateAppointmentStatus(id, status);

        // Send notification about status change
        try {
            const updatedAppointment = { ...appointment, status };
            await sendAppointmentEmail(updatedAppointment, 'update');
            await sendWhatsAppNotification(updatedAppointment, 'update');
        } catch (notifError) {
            console.error('Notification error:', notifError);
        }

        res.json({ message: 'Appointment updated successfully' });
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ message: 'Failed to update appointment' });
    }
});

// Delete appointment (admin only)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.deleteAppointment(id);

        if (!result.deleted) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({ message: 'Failed to delete appointment' });
    }
});

module.exports = router;
