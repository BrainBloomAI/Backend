const { User } = require('../models');
const { Logger, Extensions } = require('../services');

require('dotenv').config()

const authorise = async (req, res, next) => {
    const authToken = req.headers.authtoken;
    if (!authToken) {
        return res.status(401).send("ERROR: Access unauthorised.");
    }

    try {
        const targetUser = await User.findOne({
            where: {
                authToken: authToken
            },
            attributes: ['userID', 'lastLogin', 'authToken', 'banned']
        })
        if (!targetUser) {
            return res.status(401).send("ERROR: Access unauthorised.");
        }

        if (Extensions.timeDiffInSeconds(new Date(targetUser.lastLogin), new Date()) > 10800) {
            targetUser.authToken = null;
            await targetUser.save();

            return res.status(401).send("ERROR: Access unauthorised.");
        }

        if (targetUser.banned === true) {
            return res.status(403).send("ERROR: Account has been banned.");
        }

        req.userID = targetUser.userID;
        next();
    } catch (err) {
        Logger.log(`AUTH ERROR: Failed to retrieve and validate request authorisation token; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
}

const authoriseStaff = async (req, res, next) => {
    const authToken = req.headers.authtoken;
    if (!authToken) {
        return res.status(401).send("ERROR: Access unauthorised.");
    }

    try {
        const targetUser = await User.findOne({
            where: {
                authToken: authToken
            },
            attributes: ['userID', 'lastLogin', 'authToken', 'role', 'banned']
        })
        if (!targetUser) {
            return res.status(401).send("ERROR: Access unauthorised.");
        }

        if (Extensions.timeDiffInSeconds(new Date(targetUser.lastLogin), new Date()) > 10800) {
            targetUser.authToken = null;
            await targetUser.save();

            return res.status(401).send("ERROR: Access unauthorised.");
        }

        if (targetUser.banned === true) {
            return res.status(403).send("ERROR: Account has been banned.");
        }

        if (targetUser.role !== 'staff') {
            return res.status(403).send("ERROR: Access unauthorised.");
        }

        req.userID = targetUser.userID;
        next();
    } catch (err) {
        Logger.log(`AUTH ERROR: Failed to retrieve and validate request authorisation token; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
}

module.exports = { authorise, authoriseStaff };