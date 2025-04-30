// Handles requests to routes that don't exist (404)
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error); // Pass the error to the next middleware (our general error handler)
};

// General error handler - catches errors passed via next(error)
// Note the 'err' parameter - this signature tells Express it's an error handler
const errorHandler = (err, req, res, next) => {
    // Sometimes errors might come with a status code, otherwise default to 500
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;

    // Mongoose Bad ObjectId Error (CastError) - Handle specifically for cleaner message
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 404; // Treat invalid ObjectId as Not Found
        message = 'Resource not found';
    }

    // Mongoose Duplicate Key Error (code 11000)
     if (err.code === 11000) {
         statusCode = 400; // Bad Request
         const field = Object.keys(err.keyValue)[0];
         message = `Duplicate field value entered for '${field}'. Please use another value.`;
     }

     // Mongoose Validation Error
     if (err.name === 'ValidationError') {
         statusCode = 400; // Bad Request
         // Combine multiple validation error messages if they exist
         message = Object.values(err.errors)
             .map((val) => val.message)
             .join(', ');
     }


    // Send the error response
    res.status(statusCode).json({
        message: message,
        // Optionally include stack trace in development mode
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export { notFound, errorHandler };