import { Router } from "express";
import { registerUser, loginUser, logoutUser, newAccessToken, changePassword, profile, editProfile } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const userRouter = Router()

userRouter.route('/register').post(upload.fields([
    {
        name: 'avatar',
        maxCount: 1
    },
    {
        name: 'coverImage',
        maxCount: 1
    }
]), registerUser)

userRouter.route("/login").post(loginUser)

userRouter.route("/logout").post(verifyJWT, logoutUser)

userRouter.route("/refresh-token").post(newAccessToken)

userRouter.route("/change-password").post(verifyJWT, changePassword)

userRouter.route("/profile").get(verifyJWT, profile)

userRouter.route("/edit-profile").post(verifyJWT, editProfile)

export default userRouter

