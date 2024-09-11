const express = require('express');
const { Scenario } = require('../models');
const { Logger } = require('../services');
const { authoriseStaff } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // Fetch all scenarios
        const scenarios = await Scenario.findAll();
        if (!scenarios) {
            return res.status(404).send(`ERROR: No scenarios found.`);
        }

        // Return scenarios
        const scenariosJSON = scenarios.map(scenario => scenario.toJSON());
        return res.status(200).send(scenariosJSON);
    } catch (err) {
        Logger.log(`SCENARIO GET ERROR: Failed to fetch scenarios; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

// router.post('/new', authoriseStaff, async (req, res) => {
//     var staffUser;
//     try {
//         staffUser = await User.findByPk(req.userID);
//     } catch (err) {
//         Logger.log(`SCENARIO NEW ERROR: Failed to fetch user; error: ${err}`);
//         return res.status(500).send(`ERROR: Failed to process request.`);
//     }
// })

module.exports = { router, at: '/scenario' };