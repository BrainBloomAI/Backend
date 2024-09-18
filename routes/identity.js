const express = require('express');
const yup = require('yup');
const { v4: uuidv4 } = require('uuid');
const { User, GameEvaluation } = require('../models');
const { Encryption, Logger, Universal, Extensions } = require('../services');
const { authorise, authoriseStaff } = require('../middleware/auth');
const { Model } = require('sequelize');

const router = express.Router();

router.get('/', authorise, async (req, res) => {
    try {
        var user;
        if (req.query.targetUsername) {
            const staffUser = await User.findByPk(req.userID, { attributes: ["userID", "role"] });
            if (staffUser.role != "staff") {
                return res.status(403).send(`ERROR: Insufficient permissions.`);
            }

            user = await User.findOne({ where: { username: req.query.targetUsername } });
        } else {
            user = await User.findByPk(req.userID);
        }
        if (!user) {
            return res.status(404).send(`ERROR: User not found.`);
        }

        var data = user.toJSON();
        const computePerformance = req.query.computePerformance === 'true' && user.role == "standard";
        const includeLatestEvaluation = req.query.includeLatestEvaluation === 'true' && user.role == "standard";

        if (computePerformance) {
            data.aggregatePerformance = await Extensions.computeAggregatePerformance(user);
        }
        if (includeLatestEvaluation) {
            const playedGamesWithEvaluations = (await user.getPlayedGames({
                include: [
                    {
                        model: GameEvaluation,
                        as: "evaluation"
                    }
                ]
            })).filter(g => g.evaluation != null);

            if (playedGamesWithEvaluations.length == 0) {
                data.latestEvaluation = null;
            } else {
                const evaluations = playedGamesWithEvaluations.map(g => g.evaluation);
                var latestEval = evaluations[0];
                for (const eval of evaluations) {
                    if (eval.createdAt > latestEval.createdAt) {
                        latestEval = eval;
                    }
                }

                data.latestEvaluation = latestEval.toJSON();
            }
        }

        return res.send(Extensions.sanitiseData(
            data,
            [],
            ["password", "authToken", "createdAt", "updatedAt"]
        ))
    } catch (err) {
        Logger.log(`IDENTITY GET ERROR: Failed to process identity retrieval; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.get('/aggregatePerformance', authorise, async (req, res) => {
    try {
        var user = await User.findByPk(req.userID);
        if (user.role == "staff") {
            if (!req.query.targetUsername) {
                return res.status(400).send(`ERROR: Target username not provided.`);
            }

            user = await User.findOne({ where: { username: req.query.targetUsername } });
        }
        if (!user || user.role != "standard") {
            return res.status(404).send(`ERROR: User not found.`);
        }

        const performance = await Extensions.computeAggregatePerformance(user);
        if (!performance) {
            return res.status(404).send(`ERROR: Not enough data to compute aggregate performance.`);
        }

        return res.send(performance);
    } catch (err) {
        Logger.log(`IDENTITY AGGREGATEPERFORMANCE ERROR: Failed to compute aggregate performance for identity; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

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

        if (Extensions.timeDiffInSeconds(new Date(user.lastLogin), new Date()) > 604200) {
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

router.post('/update', authorise, async (req, res) => {
    var user;
    try {
        user = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`IDENTITY UPDATE ERROR: Failed to retrieve user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const schema = yup.object().shape({
        username: yup.string().trim().min(1).optional(),
        email: yup.string().trim().email().optional()
    })

    var validatedData;
    try {
        validatedData = schema.validateSync(req.body, { abortEarly: false });
    } catch (err) {
        const validationErrors = err.errors.join(' ');
        return res.status(400).send(`ERROR: ${validationErrors}`);
    }

    if (!validatedData.username && !validatedData.email) {
        return res.send('SUCCESS: Nothing to update.')
    }

    try {
        if (validatedData.username) {
            if (validatedData.username == user.username) {
                return res.status(400).send(`ERROR: New username must be different from current username.`);
            }

            if (await User.findOne({ where: { username: validatedData.username } })) {
                return res.status(400).send(`UERROR: Username already in use.`);
            }
            user.username = validatedData.username;
        }

        if (validatedData.email) {
            if (validatedData.email == user.email) {
                return res.status(400).send(`ERROR: New email must be different from current email.`);
            }
            if (await User.findOne({ where: { email: validatedData.email } })) {
                return res.status(400).send(`UERROR: Email address already in use.`);
            }
            user.email = validatedData.email;
        }

        await user.save();

        Logger.log(`IDENTITY UPDATE: User '${user.username}' updated.`);
        return res.status(200).send(`SUCCESS: Account updated successfully.`);
    } catch (err) {
        Logger.log(`IDENTITY UPDATE ERROR: Failed to update account; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/changePassword', authorise, async (req, res) => {
    var user;
    try {
        user = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`IDENTITY CHANGEPASSWORD ERROR: Failed to retrieve user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
        return res.status(400).send(`ERROR: One or more required payloads not provided.`);
    }
    if (oldPassword == newPassword) {
        return res.status(400).send(`ERROR: New password must be different from current password.`);
    }
    if (newPassword.length < 8) {
        return res.status(400).send(`ERROR: New password must be at least 8 characters long.`);
    }

    // Validate current password
    try {
        if (!await Encryption.compare(oldPassword, user.password)) {
            return res.status(401).send(`UERROR: Invalid password.`);
        }
    } catch (err) {
        Logger.log(`IDENTITY CHANGEPASSWORD ERROR: Failed to validate password; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    // Update password
    try {
        user.password = await Encryption.hash(newPassword);
        user.authToken = null;
        await user.save();

        Logger.log(`IDENTITY CHANGEPASSWORD: Password changed for user '${user.username}'.`);
        return res.status(200).send(`SUCCESS: Password changed successfully. Please re-login.`);
    } catch (err) {
        Logger.log(`IDENTITY CHANGEPASSWORD ERROR: Failed to change password; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/delete', authorise, async (req, res) => {
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