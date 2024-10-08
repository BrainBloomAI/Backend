const express = require('express');
const { Scenario, User, Game, GameDialogue, DialogueAttempt, GameEvaluation } = require('../models');
const { Logger, Universal, Extensions, OpenAIChat } = require('../services');
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
async function getFullGame(gameID, json = false, includeDialogues = false, includeAttempts = false, includeScenario = false, includeEvaluation = false, whereClause = null) {
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
        if (includeScenario) {
            includeObject.push({
                model: Scenario,
                as: "scenario"
            })
        }
        if (includeEvaluation) {
            includeObject.push({
                model: GameEvaluation,
                as: 'evaluation'
            })
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

function classifyDifficultLevelForUser(user) {
    const numericalDomains = [
        user.mindsListening,
        user.mindsEQ,
        user.mindsTone,
        user.mindsHelpfulness,
        user.mindsClarity
    ]

    var easyIndicators = 0;
    var mediumIndicators = 0;
    var hardIndicators = 0;
    for (const domain of numericalDomains) {
        if (!domain || typeof domain !== "number") {
            easyIndicators += 1;
        } else if (domain <= 60) {
            easyIndicators += 1;
        } else if (domain <= 80) {
            mediumIndicators += 1;
        } else {
            hardIndicators += 1;
        }
    }

    if (easyIndicators >= 2) {
        // console.log("CLASSIFICATION: easy")
        return "easy";
    } else if (mediumIndicators >= 2) {
        // console.log("CLASSIFICATION: medium")
        return "medium";
    } else {
        // console.log("CLASSIFICATION: hard")
        return "hard";
    }
}

async function evaluateAttempt(game, attempt, user) {
    const conversationLog = Extensions.prepGameDialogueForAI(game);
    const evaluationInput = {
        conversationLog: conversationLog,
        targetAttempt: attempt.content
    }

    try {
        const evaluationResponse = await OpenAIChat.evaluateResponse(evaluationInput, Extensions.prepScenarioForAI(game.scenario));
        if (typeof evaluationResponse !== "boolean") {
            Logger.log(`GAME EVALUATEATTEMPT ERROR: Evaluation response was not a boolean; response: ${evaluationResponse}`);
            return null;
        } else {
            if (evaluationResponse) {
                return { evaluationResponse };
            } else {
                const guidingAIQuestion = await OpenAIChat.generateGuidedQuestion(evaluationInput, Extensions.prepScenarioForAI(game.scenario), classifyDifficultLevelForUser(user));
                if (!guidingAIQuestion || !guidingAIQuestion.content) {
                    Logger.log(`GAME EVALUATEATTEMPT ERROR: Failed to generate suggested AI response for user with ID '${game.userID}'.`);
                    return null;
                }

                return { evaluationResponse, guidingAIQuestion: guidingAIQuestion.content };
            }
        }
    } catch (err) {
        Logger.log(`GAME EVALUATEATTEMPT ERROR: Failed to evaluate attempt for user with ID '${game.userID}'; error: ${err}`);
        return null;
    }
}

function calculatePointsEarned(game, evaluation) {
    var pointsEarned = 10;

    // Give additional points based on evaluation performance
    if (evaluation.listening >= 65) {
        pointsEarned += 3;
    }
    if (evaluation.eq >= 65) {
        pointsEarned += 3;
    }
    if (evaluation.tone >= 65) {
        pointsEarned += 3;
    }
    if (evaluation.helpfulness >= 65) {
        pointsEarned += 3;
    }
    if (evaluation.clarity >= 65) {
        pointsEarned += 3;
    }

    // Give bonus points for no failed attempts
    var fullySuccessfulDialogues = 0;
    for (let i = 0; i < game.dialogues.length; i++) {
        if (game.dialogues[i].by == "user" && game.dialogues[i].attemptsCount === 1) {
            fullySuccessfulDialogues += 1;
        }
    }

    if (fullySuccessfulDialogues == 4) {
        pointsEarned += 5;
    }

    return pointsEarned;
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

    var { activeGame, gameID, includeDialogues, includeScenario, includeEvaluation, includeSimpleConversationLog, targetUsername } = req.query;
    activeGame = activeGame === "true";
    includeDialogues = includeDialogues === "true";
    includeScenario = includeScenario === "true";
    includeEvaluation = includeEvaluation === "true";
    includeSimpleConversationLog = includeSimpleConversationLog === "true";

    var staffUser;
    if (user.role == "staff") {
        staffUser = user;

        if (targetUsername) {
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
        } else {
            user = null;
        }
    }

    try {
        if (gameID) {
            // Any user requesting specific game
            const fullGame = await getFullGame(gameID, false, includeDialogues || includeSimpleConversationLog, includeDialogues || includeSimpleConversationLog, includeScenario, includeEvaluation);
            if (!fullGame) {
                return res.status(404).send('ERROR: Game not found.');
            }

            if (user && !staffUser && fullGame.userID !== user.userID) {
                return res.status(403).send('ERROR: Insufficient permissions.');
            }

            var data = Extensions.sanitiseData(fullGame.toJSON(), [], ["createdAt", "updatedAt"]);
            if (includeSimpleConversationLog) {
                data.conversationLog = Extensions.prepGameDialogueForAI(fullGame, false);
                if (!includeDialogues) {
                    delete data.dialogues;
                }
            }

            return res.send(data);
        } else if (activeGame === true && !staffUser) {
            // Standard user requesting active game
            if (!user.activeGame) {
                return res.status(404).send('ERROR: No active game found.');
            }

            const fullGame = await getFullGame(user.activeGame, false, includeDialogues || includeSimpleConversationLog, includeDialogues || includeSimpleConversationLog, includeScenario, includeEvaluation);
            if (!fullGame) {
                return res.status(404).send('ERROR: Game not found.');
            }

            if (fullGame.userID !== user.userID) {
                user.activeGame = null;
                await user.save();

                return res.status(403).send('ERROR: Insufficient permissions.');
            }

            var data = Extensions.sanitiseData(fullGame.toJSON(), [], ["createdAt", "updatedAt"])
            if (includeSimpleConversationLog) {
                data.conversationLog = Extensions.prepGameDialogueForAI(fullGame, false);
                if (!includeDialogues) {
                    delete data.dialogues;
                }
            }

            return res.send(data);
        } else if (user) {
            // Standard user requesting all games or staff user requesting all games for a specific user
            const includeObject = [];
            if (includeDialogues || includeSimpleConversationLog) {
                includeObject.push({
                    model: GameDialogue,
                    as: "dialogues",
                    include: [{
                        model: DialogueAttempt,
                        as: "attempts",
                        order: [["attemptNumber", "ASC"]]
                    }],
                    order: [["createdAt", "ASC"]]
                })
            }
            if (includeScenario) {
                includeObject.push({
                    model: Scenario,
                    as: "scenario"
                })
            }
            if (includeEvaluation) {
                includeObject.push({
                    model: GameEvaluation,
                    as: 'evaluation'
                })
            }

            const games = await Game.findAll({
                where: {
                    userID: user.userID
                },
                include: includeObject
            })

            if (!games) {
                return res.status(404).send('ERROR: No games found.');
            }

            const gamesJSON = games.map(game => {
                var data = Extensions.sanitiseData(game.toJSON(), [], ["createdAt", "updatedAt"]);
                if (includeSimpleConversationLog) {
                    data.conversationLog = Extensions.prepGameDialogueForAI(game, false);
                    if (!includeDialogues) {
                        delete data.dialogues;
                    }
                }
                return data;
            });

            return res.send(gamesJSON);
        } else if (staffUser) {
            // Staff user requesting all games
            const includeObject = [];
            if (includeDialogues || includeSimpleConversationLog) {
                includeObject.push({
                    model: GameDialogue,
                    as: "dialogues",
                    include: [{
                        model: DialogueAttempt,
                        as: "attempts",
                        order: [["attemptNumber", "ASC"]]
                    }],
                    order: [["createdAt", "ASC"]]
                })
            }
            if (includeScenario) {
                includeObject.push({
                    model: Scenario,
                    as: "scenario"
                })
            }
            if (includeEvaluation) {
                includeObject.push({
                    model: GameEvaluation,
                    as: 'evaluation'
                })
            }

            const games = await Game.findAll({
                include: includeObject
            })

            if (!games) {
                return res.status(404).send('ERROR: No games found.');
            }

            const gamesJSON = games.map(game => {
                var data = Extensions.sanitiseData(game.toJSON(), [], ["createdAt", "updatedAt"]);
                if (includeSimpleConversationLog) {
                    data.conversationLog = Extensions.prepGameDialogueForAI(game, false);
                    if (!includeDialogues) {
                        delete data.dialogues;
                    }
                }
                return data;
            });

            return res.send(gamesJSON);
        } else {
            return res.status(400).send('ERROR: Abnormal payload provided.')
        }
    } catch (err) {
        Logger.log(`GAME GET ERROR: Failed to fetch game(s); error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
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

    if (!OpenAIChat.checkPermission()) {
        return res.status(503).send('ERROR: AI systems are not available at this time.');
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
    var initialPromptResponse;
    try {
        initialPromptResponse = await OpenAIChat.generateInitialMessage(Extensions.prepScenarioForAI(targetScenario), classifyDifficultLevelForUser(user));
        if (!initialPromptResponse || !initialPromptResponse.content) {
            Logger.log(`GAME NEW ERROR: Failed to generate initial AI response for user with ID '${user.userID}'.`);
            return res.status(500).send(`ERROR: Failed to process request.`);
        }
    } catch (err) {
        Logger.log(`GAME NEW ERROR: Failed to generate initial AI response for user with ID '${user.userID}'; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
    const initialPrompt = initialPromptResponse.content;

    // Generate initial AI GameDialogue
    var aiDialogue;
    var aiDialogueAttempt;

    try {
        aiDialogue = await GameDialogue.create({
            dialogueID: Universal.generateUniqueID(),
            gameID: newGame.gameID,
            by: "system",
            successful: true,
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

    if (!OpenAIChat.checkPermission()) {
        return res.status(503).send('ERROR: AI systems are not available at this time.');
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

        await game.reload();
    } catch (err) {
        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to create new dialogue attempt for user with ID '${user.userID}'; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    // Perform AI evaluation of content
    var evaluationData;
    if (req.body.debugSuccess !== true) {
        try {
            evaluationData = await evaluateAttempt(game, newAttempt, user);
            if (!evaluationData) {
                Logger.log(`GAME NEWDIALOGUE ERROR: Failed to evaluate attempt for user with ID '${user.userID}'; null value returned.`);
                return res.status(500).send(`ERROR: Failed to process request.`);
            }
        } catch (err) {
            Logger.log(`GAME NEWDIALOGUE ERROR: Failed to evaluate attempt for user with ID '${user.userID}'; error: ${err}`);
            return res.status(500).send(`ERROR: Failed to process request.`);
        }
    }

    const responseMode = req.body.debugSuccess === true ? "success" : (evaluationData.evaluationResponse ? "success" : "retry"); // "retry" or "success"
    const guidingAIQuestion = req.body.debugSuccess === true ? "Sample guiding AI question." : (evaluationData.guidingAIQuestion ? evaluationData.guidingAIQuestion : null);

    // Update attempt information
    if (responseMode == "success") {
        try {
            newAttempt.successful = true;
            await newAttempt.save();

            targetDialogue.successful = true;
            await targetDialogue.save();

            await game.reload();

            // Determine follow-ups if needed based on conversation length
            if (dialoguesLength == 8) {
                // Conversation is complete
                game.status = "complete";
                await game.save();

                user.activeGame = null;
                await user.save();

                // Don't want errors in evaluation to prevent game completion response
                var errorsOccurred = false;

                // Conduct AI evaluation of game
                var gameEvaluationData;
                try {
                    gameEvaluationData = await OpenAIChat.evaluateConversation({ conversationLog: Extensions.prepGameDialogueForAI(game, false, true) }, Extensions.prepScenarioForAI(game.scenario));
                    if (!gameEvaluationData) {
                        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to evaluate conversation for user with ID '${user.userID}'; null value returned.`);
                        errorsOccurred = true;
                    }
                } catch (err) {
                    Logger.log(`GAME NEWDIALOGUE ERROR: Failed to evaluate conversation for user with ID '${user.userID}'; error: ${err}`);
                    errorsOccurred = true;
                }

                var evaluation;
                if (!errorsOccurred) {
                    try {
                        evaluation = await GameEvaluation.create({
                            evaluationID: Universal.generateUniqueID(),
                            associatedGameID: game.gameID,
                            listening: gameEvaluationData.scores.listening,
                            eq: gameEvaluationData.scores.emotionalIntelligence,
                            tone: gameEvaluationData.scores.tone,
                            helpfulness: gameEvaluationData.scores.helpfulness,
                            clarity: gameEvaluationData.scores.clarity,
                            simpleDescription: gameEvaluationData.descriptions.userFeedback,
                            fullDescription: gameEvaluationData.descriptions.staffFeedback
                        })
                        if (!evaluation) {
                            Logger.log(`GAME NEWDIALOGUE ERROR: Failed to create evaluation for user with ID '${user.userID}'.`);
                            errorsOccurred = true;
                        }
                    } catch (err) {
                        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to create evaluation for user with ID '${user.userID}'; error: ${err}`);
                        errorsOccurred = true;
                    }
                }

                if (!errorsOccurred) {
                    const pointsEarned = calculatePointsEarned(game, evaluation);

                    try {
                        game.pointsEarned = pointsEarned;
                        await game.save();

                        user.points += pointsEarned;
                        await user.save();
                    } catch (err) {
                        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to update game and user points for user with ID '${user.userID}'; error: ${err}`);
                        return res.status(500).send(`ERROR: Failed to process request.`);
                    }

                    return res.send({
                        message: "SUCCESS: Conversation complete. Thanks for playing!",
                        pointsEarned: pointsEarned,
                        feedback: evaluation.simpleDescription
                    });
                } else {
                    return res.send({
                        message: 'SUCCESS: Conversation complete. Thanks for playing! Something went wrong in evaluating your performance. Please try again later.'
                    })
                }
            } else if (dialoguesLength == 6) {
                // Generate wrap-up AI follow-up dialogue

                var aiWrapUp;
                try {
                    aiWrapUp = await OpenAIChat.generateWrapUpMessage({
                        conversationLog: Extensions.prepGameDialogueForAI(game)
                    }, Extensions.prepScenarioForAI(game.scenario), classifyDifficultLevelForUser(user));
                    if (!aiWrapUp || !aiWrapUp.content) {
                        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to generate wrap-up AI response for user with ID '${user.userID}'.`);
                        return res.status(500).send(`ERROR: Failed to process request.`);
                    }
                } catch (err) {
                    Logger.log(`GAME NEWDIALOGUE ERROR: Failed to generate wrap-up AI response for user with ID '${user.userID}'; error: ${err}`);
                    return res.status(500).send(`ERROR: Failed to process request.`);
                }

                const aiWrapUpDialogue = await GameDialogue.create({
                    dialogueID: Universal.generateUniqueID(),
                    gameID: game.gameID,
                    by: "system",
                    successful: true,
                    attemptsCount: 1,
                    createdTimestamp: new Date().toISOString()
                })

                const aiWrapUpAttempt = await DialogueAttempt.create({
                    attemptID: Universal.generateUniqueID(),
                    dialogueID: aiWrapUpDialogue.dialogueID,
                    attemptNumber: 1,
                    content: aiWrapUp.content,
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

                var generatedAIFollowUp;
                try {
                    generatedAIFollowUp = await OpenAIChat.generateNextMessage({
                        conversationLog: Extensions.prepGameDialogueForAI(game)
                    }, Extensions.prepScenarioForAI(game.scenario), classifyDifficultLevelForUser(user));
                    if (!generatedAIFollowUp || !generatedAIFollowUp.content) {
                        Logger.log(`GAME NEWDIALOGUE ERROR: Failed to generate follow-up AI response for user with ID '${user.userID}'.`);
                        return res.status(500).send(`ERROR: Failed to process request.`);
                    }
                } catch (err) {
                    Logger.log(`GAME NEWDIALOGUE ERROR: Failed to generate follow-up AI response for user with ID '${user.userID}'; error: ${err}`);
                    return res.status(500).send(`ERROR: Failed to process request.`);
                }

                const aiDialogue = await GameDialogue.create({
                    dialogueID: Universal.generateUniqueID(),
                    gameID: game.gameID,
                    by: "system",
                    successful: true,
                    attemptsCount: 1,
                    createdTimestamp: new Date().toISOString()
                })

                const aiAttempt = await DialogueAttempt.create({
                    attemptID: Universal.generateUniqueID(),
                    dialogueID: aiDialogue.dialogueID,
                    attemptNumber: 1,
                    content: generatedAIFollowUp.content,
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
            guidingAIQuestion: guidingAIQuestion
        })
    }
})

router.post('/requestEvaluation', authorise, async (req, res) => {
    var user;
    try {
        user = await User.findByPk(req.userID);
    } catch (err) {
        Logger.log(`GAME REQUESTEVALUATION ERROR: Failed to fetch user; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const { gameID } = req.body;
    if (!gameID) {
        return res.status(400).send(`ERROR: One or more required payloads not provided.`);
    }

    if (!OpenAIChat.checkPermission()) {
        return res.status(503).send('ERROR: AI systems are not available at this time.');
    }

    var game;
    try {
        game = await getFullGame(gameID, false, true, true, true, true);
        if (!game) {
            return res.status(404).send(`ERROR: Game not found.`);
        }
    } catch (err) {
        Logger.log(`GAME REQUESTEVALUATION ERROR: Failed to find game; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    if (game.status !== "complete") {
        return res.status(400).send('ERROR: Only complete games can be evaluated.');
    }
    if (game.evaluation) {
        if (user.role !== "staff") {
            return res.status(400).send('ERROR: Game has already been evaluated.');
        } else {
            try {
                await game.evaluation.destroy();
            } catch (err) {
                Logger.log(`GAME REQUESTEVALUATION ERROR: Failed to delete existing evaluation for game with ID '${game.gameID}'; error: ${err}`);
                return res.status(500).send('ERROR: Failed to process request.');
            }
        }
    }

    // Conduct AI evaluation
    var gameEvaluationData;
    try {
        gameEvaluationData = await OpenAIChat.evaluateConversation({ conversationLog: Extensions.prepGameDialogueForAI(game, false, true) }, Extensions.prepScenarioForAI(game.scenario));
        if (!gameEvaluationData) {
            Logger.log(`GAME REQUESTEVALUATION ERROR: Failed to evaluate game with ID '${game.gameID}'.`);
            return res.status(500).send('ERROR: Failed to process request.');
        }
    } catch (err) {
        Logger.log(`GAME REQUESTEVALUATION ERROR: Failed to evaluate game with ID '${game.gameID}'; error: ${err}`);
        return res.status(500).send('ERROR: Failed to process request.');
    }

    var evaluation;
    try {
        evaluation = await GameEvaluation.create({
            evaluationID: Universal.generateUniqueID(),
            associatedGameID: game.gameID,
            listening: gameEvaluationData.scores.listening,
            eq: gameEvaluationData.scores.emotionalIntelligence,
            tone: gameEvaluationData.scores.tone,
            helpfulness: gameEvaluationData.scores.helpfulness,
            clarity: gameEvaluationData.scores.clarity,
            simpleDescription: gameEvaluationData.descriptions.userFeedback,
            fullDescription: gameEvaluationData.descriptions.staffFeedback
        })
        if (!evaluation) {
            Logger.log(`GAME REQUESTEVALUATION ERROR: Failed to create evaluation for game with ID ${game.gameID}.`);
            return res.status(500).send('ERROR: Failed to process request.');
        }
    } catch (err) {
        Logger.log(`GAME REQUESTEVALUATION ERROR: Failed to create evaluation for user with ID '${user.userID}'; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    const pointsEarned = calculatePointsEarned(game, evaluation);

    try {
        game.pointsEarned = pointsEarned;
        await game.save();

        if (game.userID === user.userID) {
            user.points += pointsEarned;
            await user.save();
        } else {
            const targetUser = await User.findByPk(game.userID);
            targetUser.points += pointsEarned;
            await targetUser.save();
        }
    } catch (err) {
        Logger.log(`GAME REQUESTEVALUATION ERROR: Failed to update game and user points for user with ID '${user.userID}'; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }

    return res.send({
        message: "SUCCESS: Evaluation complete.",
        pointsEarned: pointsEarned,
        feedback: evaluation.simpleDescription
    });
})

module.exports = { router, at: '/game' };