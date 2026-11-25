import userModel from "./models/User.js";


export default class Users {
    
    get = (params) =>{
        return userModel.find(params);
    }

    getBy = (params) =>{
        return userModel.findOne(params);
    }

    save = (doc) =>{
        return userModel.create(doc);
    }

    update = (id,doc) =>{
        return userModel.findByIdAndUpdate(id,{$set:doc})
    }

    // Contraseña nueva y versión de sesión +1 en una sola operación: no puede quedar
    // la contraseña cambiada con las sesiones viejas todavía válidas.
    changePassword = (id, passwordHash) =>{
        return userModel.findByIdAndUpdate(id, { $set: { password: passwordHash }, $inc: { sessionVersion: 1 } }, { new: true })
    }

    delete = (id) =>{
        return userModel.findByIdAndDelete(id);
    }
}