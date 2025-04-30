import mongoose from 'mongoose';
import dotenv from 'dotenv'; 

dotenv.config(); // Load environment variables from .env file

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URL;

        if(!mongoURI) {
            console.error('Error: MONGO_URL is not defined in .env file');
            process.exit(1);
        }

        const conn = await mongoose.connect(mongoURI)
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1); // Exit process with failure
    }
};

export default connectDB;