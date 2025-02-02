import { Router } from "express";
import { registerUser, loginUser, logoutUser, newAccessToken, changePassword, myProfile, editProfile, changeAvatar, changeCoverImage, getChannel } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const userRouter = Router()
const mainRouter = Router()

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

userRouter.route("/myProfile").get(verifyJWT, myProfile)

userRouter.route("/edit-profile").post(verifyJWT, editProfile)

userRouter.route("/change-avatar").post(verifyJWT, upload.single("avatar"), changeAvatar)

userRouter.route("/change-coverImage").post(verifyJWT, upload.single("coverImage"), changeCoverImage)

mainRouter.route("/getChannel").get(getChannel)

export {
    userRouter,
    mainRouter
}

