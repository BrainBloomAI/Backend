const express = require('express');
const yup = require('yup');
const { v4: uuidv4 } = require('uuid');
const { User } = require('../models');
const { Encryption, Logger, Universal, Extensions } = require('../services');
const authorise = require('../middleware/auth');

const router = express.Router();

router.post('/new', async (req, res) => {
    const schema = yup.object().shape({
        username: yup.string().trim().min(1).required(),
        email: yup.string().trim().email().required(),
        password: yup.string().trim().min(8).required(),
        role: yup.string().oneOf(['standard', 'staff']).required()
    })

    var validatedData;
    try {
        validatedData = schema.validateSync(req.body, { abortEarly: false });
    } catch (err) {
        const validationErrors = err.errors.join(' ');
        return res.status(400).send(`ERROR: ${validationErrors}`);
    }

    try {
        const allUsers = await User.findAll();
        if (allUsers.map(u => u.username).includes(validatedData.username)) {
            return res.status(400).send(`UERROR: Username already in use.`);
        } else if (allUsers.map(u => u.email).includes(validatedData.email)) {
            return res.status(400).send(`UERROR: Email address already in use.`);
        }

        const accountData = {
            userID: uuidv4(),
            username: validatedData.username,
            email: validatedData.email,
            password: await Encryption.hash(validatedData.password),
            role: validatedData.role,
            lastLogin: new Date().toISOString(),
            authToken: Universal.generateUniqueID(10, allUsers.map(u => u.authToken)),
            created: new Date().toISOString()
        }

        const newUser = await User.create(accountData);
        if (!newUser) {
            Logger.log(`IDENTITY NEW ERROR: Failed to create new user with provided data.`);
            return "ERROR: Failed to create new user."
        }

        Logger.log(`IDENTITY NEW: New account created: ${newUser.username}`);

        return res.status(200).send(`SUCCESS: Account created successfully. Authentication Token: ${accountData.authToken}`);
    } catch (err) {
        Logger.log(`IDENTITY NEW ERROR: Failed to create new account; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/login', async (req, res) => {
    const { username, email, password } = req.body;
    if ((!username && !email) || !password) {
        return res.status(400).send(`ERROR: One or more required payloads not provided.`);
    }

    try {
        var user;
        if (username) {
            user = await User.findOne({ where: { username: username } });
        } else {
            user = await User.findOne({ where: { email: email } });
        }
        if (!user) {
            return res.status(404).send(`UERROR: Invalid email or password.`);
        }

        if (!await Encryption.compare(password, user.password)) {
            return res.status(401).send(`UERROR: Invalid email or password.`);
        }

        user.authToken = Universal.generateUniqueID(10, (await User.findAll()).map(u => u.authToken));
        user.lastLogin = new Date().toISOString();
        await user.save();

        Logger.log(`IDENTITY LOGIN: Login successful for ${user.username}`);

        return res.status(200).send(`SUCCESS: Login successful. Authentication Token: ${user.authToken}`);
    } catch (err) {
        Logger.log(`IDENTITY LOGIN ERROR: Failed to login; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/logout', authorise, async (req, res) => {
    try {
        const user = await User.findByPk(req.userID);

        user.authToken = null;
        await user.save();

        Logger.log(`IDENTITY LOGOUT: Session terminated for ${user.username}`);

        return res.status(200).send(`SUCCESS: Session terminated.`);
    } catch (err) {
        Logger.log(`IDENTITY LOGOUT ERROR: Failed to logout; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.get('/validateSession', authorise, async (req, res) => {
    try {
        const user = await User.findByPk(req.userID);

        if (Extensions.timeDiffInSeconds(new Date(user.lastLogin), new Date()) > 10200) {
            return res.status(200).send("SUCCESS: Session validated. Refresh recommended.")
        }

        return res.status(200).send("SUCCESS: Session validated.");
    } catch (err) {
        Logger.log(`IDENTITY VALIDATESESSION ERROR: Failed to validate session; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/refreshSession', authorise, async (req, res) => {
    try {
        const user = await User.findByPk(req.userID);

        user.authToken = Universal.generateUniqueID(10, (await User.findAll()).map(u => u.authToken));
        user.lastLogin = new Date().toISOString();
        await user.save();

        Logger.log(`IDENTITY REFRESHSESSION: Session refreshed for ${user.username}`);

        return res.status(200).send(`SUCCESS: Session refreshed. Authentication Token: ${user.authToken}`);
    } catch (err) {
        Logger.log(`IDENTITY REFRESHSESSION ERROR: Failed to refresh session; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.delete('/delete', authorise, async (req, res) => {
    try {
        const requestingUser = await User.findByPk(req.userID);
        if (requestingUser.role == "standard") {
            await requestingUser.destroy();

            Logger.log(`IDENTITY DELETE: Account deleted: ${requestingUser.username}`);
            return res.status(200).send(`SUCCESS: Account deleted.`);
        } else {
            const { targetUsername } = req.body;
            if (!targetUsername) {
                return res.status(400).send(`ERROR: Target username not provided.`);
            }

            const targetUser = await User.findOne({ where: { username: targetUsername } });
            if (!targetUser) {
                return res.status(404).send(`UERROR: User not found.`);
            }
            
            await targetUser.destroy();

            Logger.log(`IDENTITY DELETE: Staff with username '${requestingUser.username}' deleted account with username '${targetUser.username}'.`);
            return res.status(200).send(`SUCCESS: Account deleted through staff permissions.`);
        }
    } catch (err) {
        Logger.log(`IDENTITY DELETE ERROR: Failed to delete account; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

module.exports = { router, at: "/identity" }