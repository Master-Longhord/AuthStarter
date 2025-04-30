import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // We'll use this for password hashing
import crypto from 'crypto'; // For generating random tokens

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide a name'], // Name is required
        },
        email: {
            type: String,
            required: [true, 'Please provide an email'], // Email is required
            unique: true, // Each email must be unique
            match: [ // Regex to validate email format
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email address',
            ],
            lowercase: true, // Store email in lowercase for consistency
        },
        password: {
            type: String,
            // Password is NOT required because users might sign up via OAuth (Google/GitHub)
            // We'll add validation later to ensure password exists if it's a password signup
            select: false, // IMPORTANT: Prevent password from being returned in queries by default
        },
        isVerified: { // For email verification status
            type: Boolean,
            default: false,
        },
        // --Email verification--
        emailVerificationToken: String,
        emailVerificationExpires: Date, // For storing expiration time of the token

        // --Password reset--
        passwordResetToken: String,
        passwordResetExpire: Date,

        // Fields for OAuth providers
        googleId: {
            type: String,
            unique: true,
            sparse: true, // Allows multiple null values for uniqueness if not set
        },
        githubId: {
            type: String,
            unique: true,
            sparse: true, // Allows multiple null values for uniqueness if not set
        },
        // Timestamps: automatically add createdAt and updatedAt fields
    },
    {
        timestamps: true,
    }
);

// --- Mongoose Middleware (Hooks) ---

// Hash password BEFORE saving a new user (if password is provided/modified)
// Note: Using 'function' keyword allows 'this' to refer to the document
userSchema.pre('save', async function (next) {
    // Only run this function if password was actually modified (or is new)
    // And also ensure password exists (for OAuth cases where it might not)
    if (!this.isModified('password') || !this.password) {
        return next();
    }

    try {
        // Generate salt & hash the password
        const salt = await bcrypt.genSalt(10); 
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error); // error handler
    }
});

// --- Mongoose Methods ---

// Instance method to compare entered password with hashed password in DB
// Note: Using 'function' keyword allows 'this' to refer to the document
userSchema.methods.matchPassword = async function (enteredPassword) {
    // 'this.password' refers to the hashed password in the document
    // Remember 'password' field has 'select: false', so we need to explicitly select it in queries
    // where we need to call matchPassword.
    return await bcrypt.compare(enteredPassword, this.password);
};

// -- Generate Email Verification Token --
// Note: Using 'function' keyword allows 'this' to refer to the document
userSchema.methods.generateEmailVerificationToken = function () {
    // Generate a random 32-byte token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    console.log('--- Generating Token ---'); // Add log
    console.log('Raw Token (for email):', verificationToken); // Add log

    // Hash the token before saving to DB for security
    // We store the hashed version and compare it later
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
        console.log('Hashed Token (to store):', this.emailVerificationToken); // Add log

    // Set expiry time (e.g., 15 minutes from now)
    this.emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    console.log('Token Expires:', new Date(this.emailVerificationExpires).toLocaleString()); // Add log
    console.log('------------------------'); // Add log

    // Return the original (unhashed) token to be sent via email
    return verificationToken;
};

//-- Generate Password Reset Token --
userSchema.methods.generatePasswordResetToken = function () {
    // Generate a random 32-byte token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before saving to DB for security
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expiry time (e.g., 10 minutes from now)
    this.passwordResetExpire = Date.now() + 10 * 60 * 1000; // 10 mins

    // Return the original (unhashed) token to be sent via email
    return resetToken;
};

// --- Create and Export Model ---
const User = mongoose.model('User', userSchema);

export default User;