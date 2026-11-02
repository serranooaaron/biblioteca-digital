import { usersService } from "../services/index.js"
import UserDTO from "../dto/User.dto.js";

const UPDATABLE_FIELDS = ["first_name", "last_name", "role"];

/**
 * @function getAllUsers
 * @description Obtiene todos los usuarios disponibles en la base de datos (sin contraseñas).
 * @route GET /api/users/
 * @returns {Object} Retorna un objeto con el estado de la operación y la lista de usuarios.
 */
const getAllUsers = async (req, res) => {
    const users = await usersService.getAll();
    res.send({ status: "success", payload: users.map(UserDTO.getPublicFrom) })
}

const getUser = async (req, res) => {
    const userId = req.params.uid;
    const user = await usersService.getUserById(userId);
    if (!user) return res.status(404).send({ status: "error", error: "User not found" })
    res.send({ status: "success", payload: UserDTO.getPublicFrom(user) })
}

// Solo se pueden cambiar nombre, apellido y rol: la contraseña o el email no se tocan por esta vía.
const updateUser = async (req, res) => {
    const userId = req.params.uid;
    const user = await usersService.getUserById(userId);
    if (!user) return res.status(404).send({ status: "error", error: "User not found" })

    const updateBody = Object.fromEntries(
        Object.entries(req.body).filter(([key]) => UPDATABLE_FIELDS.includes(key))
    );
    if (updateBody.role && !["user", "admin"].includes(updateBody.role)) {
        return res.status(400).send({ status: "error", error: "Rol inválido" });
    }
    if (updateBody.role && userId === req.user.id && updateBody.role !== "admin") {
        return res.status(400).send({ status: "error", error: "No puedes quitarte tu propio rol de administrador" });
    }
    await usersService.update(userId, updateBody);
    res.send({ status: "success", message: "User updated" })
}

const deleteUser = async (req, res) => {
    const userId = req.params.uid;
    if (userId === req.user.id) {
        return res.status(400).send({ status: "error", error: "No puedes borrar tu propia cuenta desde aquí" });
    }
    const user = await usersService.getUserById(userId);
    if (!user) return res.status(404).send({ status: "error", error: "User not found" })
    // Si se borrara con libros en su poder, esos libros quedarían prestados para siempre.
    if (user.books.length > 0) {
        return res.status(409).send({ status: "error", error: "El usuario tiene libros prestados: registra la devolución antes de borrarlo" });
    }
    await usersService.delete(userId);
    res.send({ status: "success", message: "User deleted" })
}

export default {
    deleteUser,
    getAllUsers,
    getUser,
    updateUser
}
