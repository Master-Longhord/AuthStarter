// utils/sendEmail.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const sendEmail = async (options) => {
    // 1. Create a transporter object using SMTP transport
    // Ensure EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS are in your .env
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10), // Ensure port is integer
        secure: parseInt(process.env.EMAIL_PORT || '587', 10) === 465, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER, // Your email address
            pass: process.env.EMAIL_PASS, // Your email password (or app password for Gmail)
        },
        // Optional: Add tls settings if needed for certain providers like Gmail
        // tls: {
        //     rejectUnauthorized: false // Use only for development/debugging if necessary
        // }
    });

    // 2. Define the email options
    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'AuthStarter App'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER}>`, // Sender address (use configured or default)
        to: options.email,          // List of receivers from function argument
        subject: options.subject,   // Subject line from function argument
        text: options.message,      // Plain text body from function argument
        html: options.html,         // HTML body from function argument (optional)
    };

    // 3. Send the email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return true; // Indicate success
    } catch (error) {
        console.error('Error sending email:', error);
        // Consider more robust error handling/logging in production
        return false; // Indicate failure
    }
};

export default sendEmail;