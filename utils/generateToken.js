import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config(); // Ensure JWT_SECRET and JWT_EXPIRE are loaded

const generateToken = (userId) => {
    // Check if JWT_SECRET is loaded
    if (!process.env.JWT_SECRET) {
        console.error('FATAL ERROR: JWT_SECRET is not defined in .env file.');
        process.exit(1); // Stop the application if secret is missing
    }
    // Check if JWT_EXPIRE is loaded
    if (!process.env.JWT_EXPIRE) {
        console.warn('Warning: JWT_EXPIRE is not set in .env file. Using default expiration (e.g., 1h).');
        // You could set a default here if desired, e.g., '1h'
    }

    // Create the payload for the token (what you want to encode)
    const payload = {
        userId: userId,
        // You can add other non-sensitive info like roles if needed later
    };

    // Sign the token
    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRE || '1h' // Use expiration from .env or default to 1 hour
        }
    );

    return token;
};

export default generateToken;