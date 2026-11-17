import { usersService } from "../services/index.js";
import { createHash, passwordValidation } from "../utils/index.js";
import { COOKIE_NAME, cookieOptions, signToken } from "../utils/auth.js";
import { loginLimiter, registerLimiter, waitMessage } from "../utils/loginLimiter.js";
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

export default {
    current,
    login,
    logout,
    register,
}
