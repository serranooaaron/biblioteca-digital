// Express 4 no captura errores de funciones async: este envoltorio los pasa al
// manejador de errores en lugar de dejar la request colgada o tirar el proceso.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
