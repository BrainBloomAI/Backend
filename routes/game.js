const express = require('express');
const { Scenario } = require('../models');
const { Logger } = require('../services');
const router = express.Router();

router.get('/scenarios', async (req, res) => {
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
        Logger.log(`GAME SCENARIOS ERROR: Failed to fetch scenarios; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

module.exports = { router, at: '/game' };