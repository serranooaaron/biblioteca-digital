import mongoose from 'mongoose';

const collection = 'Users';

const schema = new mongoose.Schema({
    first_name:{
        type: String,
        required:true,
        trim: true
    },
    last_name:{
        type:String,
        required:true,
        trim: true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase: true,
        trim: true
    },
    password:{
        type:String,
        required:true
    },
    role: {
        type:String,
        enum: ['user', 'admin'],
        default:'user'
    },
    books:{
        type:[
            {
                _id:{
                    type:mongoose.SchemaTypes.ObjectId,
                    ref:'Books'
                }
            }
        ],
        default:[]
    }
})

const userModel = mongoose.model(collection,schema);

export default userModel;
