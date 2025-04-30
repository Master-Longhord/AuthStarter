import express from  'express'
import dotenv from 'dotenv'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js' // Import the auth routes
import { notFound, errorHandler } from './middleware/errorMiddleware.js' // Import error handling middleware
import passport from 'passport'; // Import passport for authentication
import configurePassport from './config/passport.js'; // Import passport configuration


//load environment variables 
dotenv.config();

//connect to Database 
connectDB(); 

//Function to configure passport strategy
configurePassport();  

const app = express();

// --- Passport Middleware ---
app.use(passport.initialize());
// If using express-session for session management alongside or instead of JWTs for some parts:
// app.use(session({ secret: 'your session secret', resave: false, saveUninitialized: false }));
// app.use(passport.session()); // Must come after express-session middleware

//--Middleware--
// Body parser middleware to parse JSON bodies
app.use(express.json());

//--Routes--
app.use('/api/auth', authRoutes); // Use the auth routes defined in authRoutes.js
//--Basic Route (for testing)--
app.get('/', (req, res )=>{
    res.send('API is running.');
})

//--Error Handling Middleware--
app.use(notFound)//handles 404 errors
app.use(errorHandler)//handles all other errors

//--Define port--
const PORT = process.env.PORT || 5000; // use port from .env or default to 5000

//--Start Server--
app.listen(PORT,() => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});