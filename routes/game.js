const express = require('express');
const { Scenario, User, Game, GameDialogue, DialogueAttempt } = require('../models');
const { Logger, Universal, Extensions } = require('../services');
const authorise = require('../middleware/auth');
const router = express.Router();

/**
 * A function to fetch a full game object with all associated data, including dialogues and attempts.
 * 
 * If where clause is provided, it will be used to fetch the game. Otherwise, the gameID will be used.
 * 
 * If game is not found, null is returned.
 * 
 * @async
 * @param {string} gameID 
 * @param {boolean} json 
 * @param {boolean} includeDialogues 
 * @param {boolean} includeAttempts 
 * @param {object} whereClause 
 * @returns {Promise<object>}
 */
async function getFullGame(gameID, json = false, includeDialogues = false, includeAttempts = false, whereClause = null) {
    try {
        var includeObject = [];
        if (includeDialogues) {
            if (!includeAttempts) {
                includeObject.push({
                    model: GameDialogue,
                    as: "dialogues"
                })
            } else {
                includeObject.push({
                    model: GameDialogue,
                    as: "dialogues",
                    include: [{
                        model: DialogueAttempt,
                        as: "attempts",
                        order: [["attemptNumber", "DESC"]]
                    }],
                    order: [["createdAt", "ASC"]]
                })
            }
        }

        var game;
        if (whereClause != null) {
            game = await Game.findOne({
                where: whereClause,
                include: includeObject
            })
        } else {
            game = await Game.findByPk(gameID, {
                include: includeObject
            })
        }

        if (!game) {
            return null;
        }

        if (json) {
            return game.toJSON();
        } else {
            return game;
        }
    } catch (err) {
        return null
    }
}

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

router.post('/new', authorise, async (req, res) => {
    const user = await User.findByPk(req.userID);

    if (user.activeGame) {
        return res.status(403).send(`UERROR: You already have an active game. Abandon the game before starting a new one.`);
    }

    if (user.role !== "standard") {
        return res.status(403).send(`ERROR: Insufficient permissions.`);
    }

    const { scenarioName, scenarioID } = req.body;
    if (!scenarioName && !scenarioID) {
        return res.status(400).send(`ERROR: One or more required payloads not provided.`);
    }

    var targetScenario;
    try {
        if (scenarioID) {
            targetScenario = await Scenario.findByPk(scenarioID);
        } else {
            targetScenario = await Scenario.findOne({ where: { name: scenarioName } });
        }
        if (!targetScenario) {
            return res.status(404).send(`ERROR: Scenario not found.`);
        }
    } catch (err) {
        Logger.log(`GAME NEW ERROR: Failed to fetch target scenario; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    var newGame;
    try {
        newGame = await Game.create({
            gameID: Universal.generateUniqueID(),
            scenarioID: targetScenario.scenarioID,
            userID: user.userID,
            startedTimestamp: new Date().toISOString(),
            status: "ongoing"
        });

        user.activeGame = newGame.gameID;
        await user.save();
    } catch (err) {
        Logger.log(`GAME NEW ERROR: Failed to create new game for user '${user.userID}'; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    // Generate initial AI response (mock data for now)
    const initialPrompt = Universal.data["scenarioPrompts"][targetScenario.name][0];

    // Generate initial AI GameDialogue
    var aiDialogue;
    var aiDialogueAttempt;

    try {
        aiDialogue = await GameDialogue.create({
            dialogueID: Universal.generateUniqueID(),
            gameID: newGame.gameID,
            by: "system",
            attemptsCount: 1
        })

        aiDialogueAttempt = await DialogueAttempt.create({
            attemptID: Universal.generateUniqueID(),
            dialogueID: aiDialogue.dialogueID,
            attemptNumber: 1,
            content: initialPrompt,
            successful: true,
            timestamp: new Date().toISOString(),
            timeTaken: 0.0
        })
    } catch (err) {
        Logger.log(`GAME NEW ERROR: Failed to generate initial AI dialogue; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const fullGameJSON = await getFullGame(newGame.gameID, true, true, true);

    return fullGameJSON ?
        res.send(Extensions.sanitiseData(fullGameJSON, [], ["createdAt", "updatedAt"])) :
        res.status(500).send(`ERROR: Failed to process request.`);
})

module.exports = { router, at: '/game' };