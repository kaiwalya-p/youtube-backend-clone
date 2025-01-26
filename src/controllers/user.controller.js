import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken
        const refreshToken = await user.generateRefreshToken

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new apiError(501, "Something went wrong while generating access and refresh tokens")
    }
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
        fullName,
        username,
        avatar: avatar.url,
        password,
        email,
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

    const options = {
        httpOnly: true,
        secure: true
    }

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
    await User.findByIdAndUpdate(req.user._id, {$set: {refreshToken: undefined}}, {new: true})

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(204)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(205, {}, "User logged out"))
    
})

export {
    registerUser,
    loginUser,
    logoutUser
}

