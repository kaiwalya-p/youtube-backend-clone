import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new apiError(501, "Something went wrong while generating access and refresh tokens")
    }
}

const options = {
    httpOnly: true,
    secure: true
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const { fullName, username, email, password } = req.body

    // validate - field must not be empty
    if ([fullName, username, email, password].some((field) => field?.trim() === '')) {
        throw new apiError(400, 'All fields are required')
    }

    // check if user already exists: username, email
    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existingUser) {
        throw new apiError(401, 'username or email already exists')
    }

    // check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path
    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar file is required")
    }

    let coverImageLocalPath;
    if (req.files.coverImage) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    // upload them(avatar, coverImage) on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar) {
        throw new apiError(403, 'Avatar is required')
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // create user object, create entry in db
    const newUser = await User.create({
        fullName: fullName.trim(),
        username: username.toLowerCase().trim(),
        avatar: avatar.url,
        password,
        email: email.trim(),
        coverImage: coverImage?.url || ""
    })

    // remove password and refresh token field from response
    const createdUser = await User.findById(newUser._id).select("-password -refreshToken")

    // check if user is created
    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user. Server error")
    }

    // return response
    return res.status(200).json(new apiResponse(201, createdUser, "User registered successfully"))

})

const loginUser = asyncHandler(async (req, res) => {
    // get details from frontend
    const { username, email, password } = req.body

    // check for empty fields
    if (!username && !email) {
        throw new apiError(404, 'Username or email is required')
    }

    if (!password) {
        throw new apiError(405, 'Password is required')
    }

    // find user in database
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new apiError(406, 'User does not exist')
    }

    // verify password
    const verifyPassword = await user.isPasswordCorrect(password)
    if (!verifyPassword) {
        throw new apiError(407, 'Password is incorrect')
    }

    // generate accessToken and refreshToken and send to user (by sending cookies)
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // login
    return res
        .status(202)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new apiResponse(
            203,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        ))

})

const logoutUser = asyncHandler(async (req, res) => {
    // clear cookies and access and refresh tokens
    const user = req.user
    user.refreshToken = ""
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new apiResponse(200, {}, "User logged out"))

})

const newAccessToken = asyncHandler(async (req, res) => {
    const userRefreshToken = req.cookies?.refreshToken || req.body.refreshToken
    if (!userRefreshToken) {
        throw new apiError(401, "Unauthorized request")
    }

    const decodedToken = jwt.verify(userRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    if (!decodedToken) {
        throw new apiError(500, "JWT error")
    }

    const user = await User.findById(decodedToken._id)
    if (!user) {
        throw new apiError(404, "Invalid refresh token")
    }

    if (userRefreshToken !== user.refreshToken) {
        throw new apiError(401, "Refresh token expired")
    }

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(new apiResponse(
            200,
            {
                accessToken, newRefreshToken
            },
            "Access and refresh token renewed"))
})

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body
    if (!(currentPassword && newPassword && confirmPassword)) {
        throw new apiError(401, "All fields are required")
    }

    if (newPassword !== confirmPassword) {
        throw new apiError(400, "newPassword and confirmPassword must be same")
    }

    const user = await User.findById(req.user?._id)
    const verifyCurrentPassword = await user.isPasswordCorrect(currentPassword)
    if (!verifyCurrentPassword) {
        throw new apiError(402, "Incorrect current password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new apiResponse(200, {}, "Password changed successfully"))
})

const myProfile = asyncHandler(async (req, res) => {

    return res
        .status(200)
        .json(new apiResponse(200, req.user, "This is your profile"))
})

const editProfile = asyncHandler(async (req, res) => {

    const user = req.user

    const { fullName, email, username } = req.body

    if (!(fullName || email || username)) {
        throw new apiError(401, "Atleast one field is required")
    }

    const usernameExists = await User.findOne({ username })
    if (usernameExists) {
        throw new apiError(403, "Username already exists")
    }

    const emailExists = await User.findOne({ email })
    if (emailExists) {
        throw new apiError(403, "Email already exists")
    }

    if (fullName) {
        user.fullName = fullName.trim()
    }

    if (email) {
        user.email = email.trim()
    }

    if (username) {
        user.username = username.toLowerCase().trim()
    }

    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new apiResponse(200, user, "Profile edited successfully"))
})

const changeAvatar = asyncHandler(async (req, res) => {
    const oldAvatarUrl = req.user.avatar

    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new apiError(404, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new apiError(500, "Error while uploading on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    const deletedFromCloudinary = await deleteFromCloudinary(oldAvatarUrl)
    if (!deletedFromCloudinary) {
        throw new apiError(502, "Failed to delete from cloudinary")
    }

    return res
        .status(200)
        .json(new apiResponse(200, user, "Avatar changed successfully"))
})

const changeCoverImage = asyncHandler(async (req, res) => {
    const oldCoverImageUrl = req.user.coverImage

    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new apiError(404, "Avatar file is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new apiError(500, "Error while uploading on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    const deletedFromCloudinary = await deleteFromCloudinary(oldCoverImageUrl)
    if (!deletedFromCloudinary) {
        throw new apiError(502, "Failed to delete from cloudinary")
    }

    return res
        .status(200)
        .json(new apiResponse(200, user, "coverImage changed successfully"))
})

const getChannel = asyncHandler(async (req, res) => {
    const {username} = req.query
    if (!username) {
        throw new apiError(400, "Please enter a username")
    }    

    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "owner",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
                createdAt: 1
            }
        }
    ])
    
    if (!channel?.length) {
        throw new apiError(404, "Channel not found")
    }

    return res
    .status(200)
    .json(new apiResponse(200, channel[0], "Channel fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    newAccessToken,
    changePassword,
    myProfile,
    editProfile,
    changeAvatar,
    changeCoverImage,
    getChannel
}

