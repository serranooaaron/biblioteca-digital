import __dirname from "./index.js";
import multer from 'multer';
import crypto from 'crypto';

const ALLOWED_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
const MAX_SIZE_MB = 2;

const storage = multer.diskStorage({
    destination:function(req,file,cb){
        cb(null,`${__dirname}/../public/img`)
    },
    // El nombre lo genera el servidor: no se usa el nombre original del archivo (evita rutas o caracteres raros).
    filename:function(req,file,cb){
        cb(null,`${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ALLOWED_TYPES[file.mimetype]}`)
    }
})

const uploader = multer({
    storage,
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
        const error = new Error('La portada debe ser una imagen JPG, PNG o WEBP');
        error.status = 400;
        cb(error);
    },
})

export default uploader;
