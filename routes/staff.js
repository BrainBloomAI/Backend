const express = require('express');
const yup = require('yup');
const { authoriseStaff } = require('../middleware/auth');
const { User } = require('../models');
const { Logger, Extensions } = require('../services');
const router = express.Router();

router.get('/viewClients', authoriseStaff, async (req, res) => {
    try {
        const allClients = await User.findAll({
            where: {
                role: 'standard'
            }
        })

        return res.send(allClients.map(c => {
            return Extensions.sanitiseData(
                c.toJSON(),
                [],
                ['password', 'authToken', 'role', 'createdAt', 'updatedAt']
            )
        }));
    } catch (err) {
        Logger.log(`STAFF VIEWCLIENTS ERROR: Failed to retrieve all clients; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/banClient', authoriseStaff, async (req, res) => {
    var staffUser;
    try {
        staffUser = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`STAFF BANCLIENT ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const { targetUsername } = req.body;
    if (!targetUsername) {
        return res.status(400).send(`ERROR: Target username not provided.`);
    }

    try {
        const targetClient = await User.findOne({ where: { username: targetUsername } })
        if (!targetClient || targetClient.role !== 'standard') {
            return res.status(404).send(`ERROR: Target client not found.`);
        }

        if (targetClient.banned !== true) {
            targetClient.banned = true;
            await targetClient.save();

            Logger.log(`STAFF BANCLIENT: ${staffUser.username} banned ${targetClient.username}`);
        }

        return res.status(200).send(`SUCCESS: Client banned.`);
    } catch (err) {
        Logger.log(`STAFF BANCLIENT ERROR: Failed to ban client; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/unbanClient', authoriseStaff, async (req, res) => {
    var staffUser;
    try {
        staffUser = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`STAFF UNBANCLIENT ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const { targetUsername } = req.body;
    if (!targetUsername) {
        return res.status(400).send(`ERROR: Target username not provided.`);
    }

    try {
        const targetClient = await User.findOne({ where: { username: targetUsername } })
        if (!targetClient || targetClient.role !== 'standard') {
            return res.status(404).send(`ERROR: Target client not found.`);
        }

        if (targetClient.banned !== false) {
            targetClient.banned = false;
            await targetClient.save();

            Logger.log(`STAFF UNBANCLIENT: ${staffUser.username} unbanned ${targetClient.username}`);
        }

        return res.status(200).send(`SUCCESS: Client unbanned.`);
    } catch (err) {
        Logger.log(`STAFF UNBANCLIENT ERROR: Failed to unban client; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/updateMindsEvaluation', authoriseStaff, async (req, res) => {
    var staffUser;
    try {
        staffUser = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`STAFF UPDATEMINDSEVALUATION ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const { targetUsername } = req.body;
    if (!targetUsername) {
        return res.status(400).send(`ERROR: Target username not provided.`);
    }

    const validationSchema = yup.object().shape({
        listening: yup.number().required().min(0).max(100),
        eq: yup.number().required().min(0).max(100),
        tone: yup.number().required().min(0).max(100),
        helpfulness: yup.number().required().min(0).max(100),
        clarity: yup.number().required().min(0).max(100),
        assessment: yup.string().required()
    })

    var validData;
    try {
        validData = await validationSchema.validate(req.body, { abortEarly: false });
    } catch (err) {
        return res.status(400).send(`ERROR: ${err.errors.join(', ')}`);
    }

    var targetUser;
    try {
        targetUser = await User.findOne({ where: { username: targetUsername } })
        if (!targetUser || targetUser.role !== 'standard') {
            return res.status(404).send(`ERROR: Target user not found.`);
        }
    } catch (err) {
        Logger.log(`STAFF UPDATEMINDSEVALUATION ERROR: Failed to fetch target user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    try {
        targetUser.mindsListening = validData.listening;
        targetUser.mindsEQ = validData.eq;
        targetUser.mindsTone = validData.tone;
        targetUser.mindsHelpfulness = validData.helpfulness;
        targetUser.mindsClarity = validData.clarity;
        targetUser.mindsAssessment = validData.assessment;

        await targetUser.save();
    } catch (err) {
        Logger.log(`STAFF UPDATEMINDSEVALUATION ERROR: Failed to update target user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    Logger.log(`STAFF UPDATEMINDSEVALUATION: ${staffUser.username} updated ${targetUser.username}'s MINDS evaluation.`);
    return res.status(200).send(`SUCCESS: MINDS evaluation updated.`);
})

router.post('/removeEvaluation', authoriseStaff, async (req, res) => {
    var staffUser;
    try {
        staffUser = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`STAFF REMOVEEVALUATION ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const { targetUsername } = req.body;
    if (!targetUsername) {
        return res.status(400).send(`ERROR: Target username not provided.`);
    }
    
    var targetUser;
    try {
        targetUser = await User.findOne({ where: { username: targetUsername } })
        if (!targetUser || targetUser.role !== 'standard') {
            return res.status(404).send(`ERROR: Target user not found.`);
        }
    } catch (err) {
        Logger.log(`STAFF REMOVEEVALUATION ERROR: Failed to fetch target user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    try {
        targetUser.mindsListening = null;
        targetUser.mindsEQ = null;
        targetUser.mindsTone = null;
        targetUser.mindsHelpfulness = null;
        targetUser.mindsClarity = null;
        targetUser.mindsAssessment = null;

        await targetUser.save();
    } catch (err) {
        Logger.log(`STAFF REMOVEEVALUATION ERROR: Failed to update target user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    Logger.log(`STAFF REMOVEEVALUATION: ${staffUser.username} removed ${targetUser.username}'s MINDS evaluation.`);
    return res.status(200).send(`SUCCESS: MINDS evaluation removed.`);
})

module.exports = { router, at: '/staff' }