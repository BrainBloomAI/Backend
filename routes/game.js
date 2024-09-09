const express = require('express');
const { Scenario, User, Game, GameDialogue, DialogueAttempt } = require('../models');
const { Logger, Universal, Extensions } = require('../services');
const { authorise } = require('../middleware/auth');
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
 * @returns {Promise<object|null>}
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
                        order: [["attemptNumber", "ASC"]]
                    }],
                    order: [["createdTimestamp", "ASC"]]
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
        Logger.log(`GAME GETFULLGAME ERROR: Failed to fetch full game with specified fetch parameters; error: ${err}`);
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

router.get("/", authorise, async (req, res) => {
    var user;
    try {
        user = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`GAME GET ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const { activeGame, gameID, includeDialogues, targetUsername } = req.body;

    var staffUser;
    if (user.role == "staff") {
        staffUser = user;

        if (!targetUsername) {
            const games = await Game.findAll({
                include: includeDialogues === true ? [{
                    model: GameDialogue,
                    as: "dialogues",
                    include: [{
                        model: DialogueAttempt,
                        as: "attempts",
                        order: [["attemptNumber", "ASC"]]
                    }],
                    order: [["createdAt", "ASC"]]
                }] : []
            })

            if (!games) {
                return res.status(404).send('ERROR: No games found.');
            }

            const gamesJSON = games.map(game => Extensions.sanitiseData(game.toJSON(), [], ["createdAt", "updatedAt"]));
            return res.send(gamesJSON);
        }

        try {
            user = await User.findOne({ where: { username: targetUsername } });
            if (!user) {
                return res.status(404).send(`ERROR: User not found.`);
            }

            if (user.role !== "standard") {
                return res.status(400).send(`ERROR: Target user is not a standard user.`);
            }
        } catch (err) {
            Logger.log(`GAME GET ERROR: Failed to fetch target user for staff account with ID '${staffUser.userID}'; error: ${err}`);
            return res.status(500).send(`ERROR: Failed to process request.`);
        }
    }

    if (!activeGame && !gameID) {
        const games = await Game.findAll({
            where: {
                userID: user.userID
            },
            include: includeDialogues === true ? [{
                model: GameDialogue,
                as: "dialogues",
                include: [{
                    model: DialogueAttempt,
                    as: "attempts",
                    order: [["attemptNumber", "ASC"]]
                }],
                order: [["createdAt", "ASC"]]
            }] : []
        })

        if (!games) {
            return res.status(404).send('ERROR: No games found.');
        }

        const gamesJSON = games.map(game => Extensions.sanitiseData(game.toJSON(), [], ["createdAt", "updatedAt"]));
        return res.send(gamesJSON);
    } else if (activeGame === true && !staffUser) {
        if (!user.activeGame) {
            return res.status(404).send('ERROR: No active game found.');
        }

        const fullGame = await getFullGame(user.activeGame, false, includeDialogues === true, includeDialogues === true);
        if (!fullGame) {
            return res.status(404).send('ERROR: Game not found.');
        }

        if (fullGame.userID !== user.userID) {
            user.activeGame = null;
            await user.save();

            return res.status(403).send('ERROR: Insufficient permissions.');
        }

        return res.send(Extensions.sanitiseData(fullGame.toJSON(), [], ["createdAt", "updatedAt"]));
    } else if (gameID) {
        const fullGame = await getFullGame(gameID, false, includeDialogues === true, includeDialogues === true);
        if (!fullGame) {
            return res.status(404).send('ERROR: Game not found.');
        }

        if (fullGame.userID !== user.userID) {
            return res.status(403).send('ERROR: Insufficient permissions.');
        }

        return res.send(Extensions.sanitiseData(fullGame.toJSON(), [], ["createdAt", "updatedAt"]));
    } else {
        return res.status(400).send('ERROR: Abnormal payload provided.')
    }
})

router.post('/new', authorise, async (req, res) => {
    var user;
    try {
        user = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`GAME NEW ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    if (user.role !== "standard") {
        return res.status(403).send(`ERROR: Insufficient permissions.`);
    }

    if (user.activeGame) {
        return res.status(403).send(`UERROR: You already have an active game. Abandon the game before starting a new one.`);
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
            attemptsCount: 1,
            createdTimestamp: new Date().toISOString()
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

router.post('/abandon', authorise, async (req, res) => {
    var user;
    try {
        user = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    if (user.role !== "standard") {
        return res.status(403).send(`ERROR: Insufficient permissions.`);
    }

    if (!user.activeGame) {
        return res.status(404).send(`ERROR: No active game found.`);
    }

    var game;
    try {
        game = await Game.findByPk(user.activeGame);
        if (!game) {
            user.activeGame = null;
            await user.save();

            return res.status(404).send(`ERROR: Game not found.`);
        } else if (game.userID !== user.userID) {
            return res.status(403).send(`ERROR: Insufficient permissions.`);
        }

        user.activeGame = null;
        await user.save();

        game.status = "abandoned";
        await game.save();

        return res.send(`SUCCESS: Game abandoned.`);
    } catch (err) {
        Logger.log(`GAME ABANDON ERROR: Failed to abandon game for user with ID '${user.userID}'; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/newDialogue', authorise, async (req, res) => {
    var user;
    try {
        user = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    if (user.role !== "standard") {
        return res.status(403).send(`ERROR: Insufficient permissions.`);
    }

    const { content, timeTaken } = req.body;
    if (!content || !timeTaken) {
        return res.status(400).send(`ERROR: One or more required payloads not provided.`);
    }

    if (!user.activeGame) {
        return res.status(404).send(`ERROR: No active game found.`);
    }

    var game;
    try {
        game = await Game.findByPk(user.activeGame, {
            include: [{
                model: GameDialogue,
                as: "dialogues",
                include: [{
                    model: DialogueAttempt,
                    as: "attempts",
                    order: [["attemptNumber", "ASC"]]
                }],
                order: [["createdTimestamp", "ASC"]]
            },
            {
                model: Scenario,
                as: "scenario"
            }]
        });
        if (!game) {
            user.activeGame = null;
            await user.save();

            return res.status(404).send(`ERROR: Game not found.`);
        }
    } catch (err) {
        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to fetch active game; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    // Check if game is ongoing
    if (game.status !== "ongoing") {
        user.activeGame = null;
        await user.save();

        return res.status(403).send(`ERROR: Game is not active.`);
    }

    // Check if last dialogue is by user
    var lastDialogue;
    for (let i = 0; i < game.dialogues.length; i++) {
        if (!lastDialogue) {
            lastDialogue = game.dialogues[i];
        } else if (lastDialogue.createdTimestamp < game.dialogues[i].createdTimestamp) {
            lastDialogue = game.dialogues[i];
        }
    }

    var dialoguesLength = game.dialogues.length;
    var targetDialogue;
    try {
        if (lastDialogue.by == "user" && lastDialogue.successful === true) {
            Logger.log(`GAME NEWDIALOGUE ERROR: Inconsistent game data (no follow-up system dialogue for ongoing game) detected for game with ID '${game.gameID}', user with ID '${user.userID}.'`);
            return res.status(500).send(`ERROR: Game data is inconsistent. Please abandon this game and create a new one.`);
        } else if (lastDialogue.by == "user") {
            targetDialogue = lastDialogue;
        } else {
            targetDialogue = await GameDialogue.create({
                dialogueID: Universal.generateUniqueID(),
                gameID: game.gameID,
                by: "user",
                attemptsCount: 0,
                createdTimestamp: new Date().toISOString()
            })
            dialoguesLength += 1;
        }
    } catch (err) {
        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to identify/create new dialogue for user with ID '${user.userID}'; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    // Create new dialogue attempt
    var newAttempt;
    try {
        newAttempt = await DialogueAttempt.create({
            attemptID: Universal.generateUniqueID(),
            dialogueID: targetDialogue.dialogueID,
            attemptNumber: targetDialogue.attemptsCount + 1,
            content: content,
            successful: false,
            timestamp: new Date().toISOString(),
            timeTaken: timeTaken
        })

        targetDialogue.attemptsCount += 1;
        await targetDialogue.save();
    } catch (err) {
        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to create new dialogue attempt for user with ID '${user.userID}'; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    // Perform AI evaluation of content
    // Mock data for now
    const responseMode = req.body.debugSuccess === true ? "success" : "retry"; // "retry" or "success"
    const suggestedAIResponse = "Sample suggested AI response.";

    // Update attempt information
    if (responseMode == "success") {
        try {
            newAttempt.successful = true;
            await newAttempt.save();

            targetDialogue.successful = true;
            await targetDialogue.save();

            // Determine follow-ups if needed based on conversation length
            if (dialoguesLength == 8) {
                // Conversation is complete
                game.status = "complete";
                await game.save();

                user.activeGame = null;
                await user.save();

                res.send({ message: "SUCCESS: Conversation complete. Thanks for playing!" });
            } else if (dialoguesLength == 6) {
                // Generate wrap-up AI follow-up dialogue
                // Mock data for now

                const aiWrapUpDialogue = await GameDialogue.create({
                    dialogueID: Universal.generateUniqueID(),
                    gameID: game.gameID,
                    by: "system",
                    attemptsCount: 1,
                    createdTimestamp: new Date().toISOString()
                })

                const aiWrapUpAttempt = await DialogueAttempt.create({
                    attemptID: Universal.generateUniqueID(),
                    dialogueID: aiWrapUpDialogue.dialogueID,
                    attemptNumber: 1,
                    content: Universal.data["scenarioPrompts"][game.scenario.name][3],
                    successful: true,
                    timestamp: new Date().toISOString(),
                    timeTaken: 0.0
                })

                return res.send({
                    message: "SUCCESS: Dialogue successful. Please respond to follow-up AI dialogue.",
                    aiResponse: aiWrapUpAttempt.toJSON()
                })
            } else {
                // Generate AI follow-up dialogue
                // Mock data for now

                const aiDialogue = await GameDialogue.create({
                    dialogueID: Universal.generateUniqueID(),
                    gameID: game.gameID,
                    by: "system",
                    attemptsCount: 1,
                    createdTimestamp: new Date().toISOString()
                })

                const aiAttempt = await DialogueAttempt.create({
                    attemptID: Universal.generateUniqueID(),
                    dialogueID: aiDialogue.dialogueID,
                    attemptNumber: 1,
                    content: Universal.data["scenarioPrompts"][game.scenario.name][dialoguesLength / 2],
                    successful: true,
                    timestamp: new Date().toISOString(),
                    timeTaken: 0.0
                })

                return res.send({
                    message: "SUCCESS: Dialogue successful. Please respond to follow-up AI dialogue.",
                    aiResponse: aiAttempt.toJSON()
                })
            }
        } catch (err) {
            Logger.log(`GAME NEWDIALOGUE ERROR: Failed to update attempt information for user with ID '${user.userID}'; error: ${err}`);
            return res.status(500).send(`ERROR: Failed to process request.`);
        }
    } else {
        // Prompt client to retry, include suggested AI response for help
        res.send({
            message: "SUCCESS: Great attempt but dialogue unsuccessful. Please retry.",
            suggestedAIResponse: suggestedAIResponse
        })
    }
})

module.exports = { router, at: '/game' };