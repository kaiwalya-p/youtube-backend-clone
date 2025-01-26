import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const instance = await mongoose.connect(`${process.env.DATABASE_URL}/${DB_NAME}`)
        console.log(`Database connected. DB host: ${instance.connection.host}`);        
        
    } catch (error) {
        console.log('DB connection error:', error);
        process.exit(1)
        
    }
}

export default connectDB

