export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.expose ? err.message : (status < 500 ? err.message : "Internal server error");

  if (status >= 500) {
    console.error("[error]", err);
  }

  res.status(status).json({
    code,
    message,
    details: err.details || null,
  });
}

export function notFound(req, res) {
  res.status(404).json({ code: "NOT_FOUND", message: "Route not found", details: null });
}
