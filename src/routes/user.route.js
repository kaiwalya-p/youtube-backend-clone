import { Router } from "express";
import { registerUser, loginUser, logoutUser, newAccessToken, changePassword, myProfile, editProfile, changeAvatar, changeCoverImage, getChannel, myWatchHistory } from "../controllers/user.controller.js";
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

userRouter.route("/my-profile").get(verifyJWT, myProfile)

userRouter.route("/edit-profile").patch(verifyJWT, editProfile)

userRouter.route("/change-avatar").patch(verifyJWT, upload.single("avatar"), changeAvatar)

userRouter.route("/change-coverImage").patch(verifyJWT, upload.single("coverImage"), changeCoverImage)

mainRouter.route("/get-channel").get(getChannel)

userRouter.route("/watch-history").get(verifyJWT, myWatchHistory)

export {
    userRouter,
    mainRouter
}

