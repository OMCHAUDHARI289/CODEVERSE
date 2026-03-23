import AppError from "../utils/appError.js";

export const notFound = (req, res, next) => {
  next(new AppError(`Not found - ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, next) => {
  let error = err;

  const isDev = process.env.NODE_ENV === "development";

  // 🔥 Handle Mongoose errors
  if (error.name === "CastError") {
    error = new AppError("Invalid ID format", 400);
  }

  if (error.name === "ValidationError") {
    error = new AppError(
      Object.values(error.errors).map(e => e.message).join(", "),
      400
    );
  }

  const statusCode = error.statusCode || 500;

  // 🔥 Log error
  console.error(error);

  res.status(statusCode).json({
    status: error.status || "error",
    message: isDev ? error.message : "Something went wrong",
    ...(isDev && { stack: error.stack })
  });
};