const express = require('express');
const { User, Game, GameEvaluation, GameDialogue, DialogueAttempt, Scenario } = require('../models');
const { Logger, Extensions } = require('../services');
const util = require('util')
const router = express.Router();

router.get("/export", async (req, res) => {
    const { authToken } = req.query;
    if (!authToken) {
        return res.status(401).send('ERROR: Access unauthorised.')
    }

    var user;
    try {
        user = await User.findOne({ where: { authToken: authToken } });
        if (!user || user.role !== "staff") {
            return res.status(401).send('ERROR: Access unauthorised.')
        }
    } catch (err) {
        Logger.log(`EXPORT ERROR: Failed to validate request authorisation token; error: ${err}`);
        return res.status(500).send('ERROR: Failed to process request.')
    }

    // Process export parameters
    var {
        targetUsername,
        includeScenarios,
        includeGames,
        includeDialogues,
        includeEvaluations,
        includeSimpleConversationLog,
        includeFullConversationLog,
        computePerformance,
        exportFormat
    } = req.query;

    includeScenarios = includeScenarios === "true";

    includeGames = includeGames === "true";
    includeDialogues = includeDialogues === "true" && includeGames;
    includeEvaluations = includeEvaluations === "true" && includeGames;

    includeSimpleConversationLog = includeSimpleConversationLog === "true" && includeGames;
    includeFullConversationLog = includeFullConversationLog === "true" && includeGames;
    const conversationLogFormat = includeGames ? (includeSimpleConversationLog ? "simple" : "full") : null;

    computePerformance = computePerformance === "true";

    if (!exportFormat || !(["json", "csv", "txt"].includes(exportFormat))) {
        exportFormat = "json";
    }

    // Load all data
    const fullIncludeObject = [
        {
            model: Game,
            as: "playedGames",
            include: [
                {
                    model: GameEvaluation,
                    as: "evaluation"
                },
                {
                    model: GameDialogue,
                    as: "dialogues",
                    include: [
                        {
                            model: DialogueAttempt,
                            as: "attempts",
                            order: [["attemptNumber", "ASC"]]
                        }
                    ],
                    order: [["createdTimestamp", "ASC"]]
                },
                {
                    model: Scenario,
                    as: "scenario"
                }
            ]
        }
    ]

    var fullSourceJSON = [];
    if (targetUsername) {
        const targetUser = await User.findOne({
            where: {
                username: targetUsername
            },
            include: fullIncludeObject
        });
        if (!targetUser) {
            return res.status(404).send('ERROR: Target user not found.')
        }

        fullSourceJSON.push(targetUser.toJSON());
    } else {
        const users = await User.findAll({
            include: fullIncludeObject
        })
        
        fullSourceJSON = users.map(u => u.toJSON());
    }

    // Synthesise source data
    var sourceData = [];
    fullSourceJSON.forEach(user => {
        sourceData.concat(Extensions.flattenUserDataForCSV(user))
    })

    res.send('temp')
})

module.exports = { router, at: "/" }