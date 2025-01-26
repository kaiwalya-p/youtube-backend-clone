import "dotenv/config"
import connectDB from "./db/connect.js";
import { configDotenv } from "dotenv";
import { app } from "./app.js";

configDotenv({path: './.env'})

connectDB()
.then(() => {
    app.on('error', (error) => {
        console.log('ERR: ', error);
        throw error
        
    })

    app.listen(process.env.PORT || 3000, () => {
        console.log(`App listening on port ${process.env.PORT}`);
        
    })
})
.catch((error) => {
    console.log('DB import failed:', error);
    
})

