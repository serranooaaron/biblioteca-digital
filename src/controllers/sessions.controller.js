import { usersService } from "../services/index.js";
import { createHash, passwordValidation } from "../utils/index.js";
import { COOKIE_NAME, cookieOptions, signToken } from "../utils/auth.js";
import { createLoginLimiter, loginLimiter, registerLimiter, waitMessage } from "../utils/loginLimiter.js";

// Cambiar la contraseña pide la actual: con una sesión abierta ajena alguien podría probar
// contraseñas, así que tiene su propio límite de intentos (5 por cuenta cada 15 minutos).
export const passwordChangeLimiter = createLoginLimiter();
const NAME_MAX = 50;
import { passwordProblem } from "../public/js/passwordPolicy.js";

const register = async (req, res) => {
    const wait = registerLimiter.retryAfter(req);
    if (wait) {
        return res.status(429).set("Retry-After", String(wait)).send({ status: "error", error: waitMessage(wait, "Demasiados registros desde esta conexión") });
    }
    registerLimiter.fail(req);

    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email || !password) return res.status(400).send({ status: "error", error: "Incomplete values" });
    // La misma regla que muestra el formulario: el servidor es el que decide.
    const problem = passwordProblem(String(password), { email, first_name, last_name });
    if (problem) return res.status(400).send({ status: "error", error: problem });
    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await usersService.getUserByEmail(normalizedEmail);
    if (exists) return res.status(409).send({ status: "error", error: "User already exists" });

    const user = await usersService.create({
        first_name,
        last_name,
        email: normalizedEmail,
        password: await createHash(String(password)),
    });

    // Al registrarse, el usuario queda con la sesión iniciada.
    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    res.status(201).send({ status: "success", payload: user._id });
}

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send({ status: "error", error: "Incomplete values" });
    // Bloqueado por demasiados fallos: ni siquiera se compara la contraseña.
    const wait = loginLimiter.retryAfter(req);
    if (wait) return res.status(429).set("Retry-After", String(wait)).send({ status: "error", error: waitMessage(wait) });

    const user = await usersService.getUserByEmail(String(email).toLowerCase().trim());
    // Mismo mensaje si el email no existe o la contraseña es incorrecta: no revela qué cuentas existen.
    if (!user || !(await passwordValidation(user, String(password)))) {
        loginLimiter.fail(req);
        return res.status(401).send({ status: "error", error: "Email o contraseña incorrectos" });
    }
    loginLimiter.succeed(req);
    res.cookie(COOKIE_NAME, signToken(user), cookieOptions()).send({ status: "success", message: "Logged in", payload: { role: user.role } });
}

const logout = (req, res) => {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
    res.send({ status: "success", message: "Logged out" });
}

// requireAuth ya verificó el token: aquí solo se devuelve el usuario de la sesión.
const current = (req, res) => res.send({ status: "success", payload: req.user });

const cleanName = (value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

// Mi perfil: cambiar nombre y apellido. El email no se cambia acá: identifica la cuenta.
const updateProfile = async (req, res) => {
    const first_name = cleanName(req.body?.first_name);
    const last_name = cleanName(req.body?.last_name);
    if (!first_name || !last_name) return res.status(400).send({ status: "error", error: "Completa nombre y apellido" });
    if (first_name.length > NAME_MAX || last_name.length > NAME_MAX) {
        return res.status(400).send({ status: "error", error: `Nombre y apellido pueden tener hasta ${NAME_MAX} caracteres` });
    }
    await usersService.update(req.user.id, { first_name, last_name });
    res.send({ status: "success", payload: { first_name, last_name } });
}

// Mi perfil: cambiar la contraseña. Pide la actual, aplica la misma regla que el registro
// y cierra las demás sesiones (sube la versión de sesión); esta sesión recibe un token nuevo.
const changePassword = async (req, res) => {
    // El límite se cuenta por cuenta y conexión, como el login.
    const attempt = { ip: req.ip, body: { email: req.user.email } };
    const wait = passwordChangeLimiter.retryAfter(attempt);
    if (wait) return res.status(429).set("Retry-After", String(wait)).send({ status: "error", error: waitMessage(wait) });

    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (!currentPassword || !newPassword) return res.status(400).send({ status: "error", error: "Completa la contraseña actual y la nueva" });

    const user = await usersService.getUserById(req.user.id);
    if (!user) return res.status(401).send({ status: "error", error: "Debes iniciar sesión" });
    if (!(await passwordValidation(user, currentPassword))) {
        passwordChangeLimiter.fail(attempt);
        return res.status(400).send({ status: "error", error: "La contraseña actual no es correcta" });
    }
    passwordChangeLimiter.succeed(attempt);

    const problem = passwordProblem(newPassword, { email: user.email, first_name: user.first_name, last_name: user.last_name });
    if (problem) return res.status(400).send({ status: "error", error: problem });
    if (await passwordValidation(user, newPassword)) {
        return res.status(400).send({ status: "error", error: "La contraseña nueva tiene que ser distinta de la actual" });
    }

    const updated = await usersService.changePassword(user._id, await createHash(newPassword));
    res.cookie(COOKIE_NAME, signToken(updated), cookieOptions());
    res.send({ status: "success", message: "Contraseña cambiada. Cerramos las demás sesiones." });
}

export default {
    changePassword,
    current,
    login,
    logout,
    register,
    updateProfile,
}
