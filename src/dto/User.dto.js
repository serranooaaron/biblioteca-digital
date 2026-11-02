export default class UserDTO {
    // Datos que se pueden mostrar de un usuario: nunca incluye la contraseña.
    static getPublicFrom = (user) => ({
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        books: user.books,
    })
}
