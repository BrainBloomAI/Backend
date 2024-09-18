const express = require('express');
const { User, Game, GameEvaluation, GameDialogue, DialogueAttempt, Scenario } = require('../models');
const { Logger, Extensions } = require('../services');
const util = require('util');
const { stringify } = require('csv-stringify');
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
        computePerformance,
        exportFormat
    } = req.query;

    includeScenarios = includeScenarios === "true";

    includeGames = includeGames === "true";
    includeDialogues = includeDialogues === "true" && includeGames;
    includeEvaluations = includeEvaluations === "true" && includeGames;

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
    try {
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
    } catch (err) {
        Logger.log(`EXPORT ERROR: Failed to retrieve user data for export; error: ${err}`);
        return res.status(500).send('ERROR: Failed to process request.')
    }

    // Do additional parameter-based data processing
    try {
        fullSourceJSON = await Promise.all(fullSourceJSON.map(async user => {
            user.banned = user.banned ? "Yes" : "No";
            user.playedGames.forEach(game => {
                game.scenarioName = game.scenario.name;

                game.dialogues.sort((a, b) => {
                    return new Date(a.createdTimestamp) - new Date(b.createdTimestamp)
                });

                game.dialogues.forEach(dialogue => {
                    dialogue.successful = dialogue.successful ? "Yes" : "No";
                    dialogue.attempts.sort((a, b) => {
                        return new Date(a.timestamp) - new Date(b.timestamp)
                    });

                    dialogue.attempts.forEach(attempt => {
                        attempt.successful = attempt.successful ? "Yes" : "No";
                    });
                })
            })

            if (computePerformance) {
                user.aggregatePerformance = await Extensions.computeAggregatePerformance(user, true);
            }

            return user;
        }));
    } catch (err) {
        Logger.log(`EXPORT ERROR: Failed to process user data for export; error: ${err}`);
        return res.status(500).send('ERROR: Failed to process request.')
    }

    // Format source data according to request parameters
    var formattedJSON = [];
    try {
        var disallowedKeys = ["createdAt", "updatedAt", "password", "authToken"];
        if (!includeScenarios) {
            disallowedKeys.push("scenario")
        }
        if (!includeGames) {
            disallowedKeys.push("playedGames")
        }
        if (!includeDialogues) {
            disallowedKeys.push("dialogues")
            disallowedKeys.push("attempts")
        }
        if (!includeEvaluations) {
            disallowedKeys.push("evaluation")
        }

        formattedJSON = fullSourceJSON.map(user => Extensions.sanitiseData(user, [], disallowedKeys));
    } catch (err) {
        Logger.log(`EXPORT ERROR: Failed to format user data for export; error: ${err}`);
        return res.status(500).send('ERROR: Failed to process request.')
    }

    try {
        if (exportFormat === "json") {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="BrainBloomAIExport.json"`);

            Logger.log(`EXPORT: '${user.username}' exported data in JSON format.`)
            return res.send(formattedJSON);
        } else if (exportFormat === "csv") {
            // Synthesise source data
            var sourceData = [];

            // Add in user, games, dialogues, attempts, evaluations
            formattedJSON.forEach(user => {
                sourceData = sourceData.concat(
                    Extensions.flattenUserDataForCSV(
                        user,
                        { includeScenarios, includeGames, includeDialogues, includeEvaluations, computePerformance }
                    )
                );
            })

            // Add in scenarios
            if (includeScenarios) {
                try {
                    const scenarios = await Scenario.findAll();
                    scenarios.forEach(scenario => {
                        sourceData = sourceData.concat(Extensions.flattenScenarioDataForCSV(scenario.toJSON()));
                    })
                } catch (err) {
                    Logger.log(`EXPORT ERROR: Failed to retrieve scenarios for export; error: ${err}`);
                    return res.status(500).send('ERROR: Failed to process request.')
                }
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="BrainBloomAIExport.csv"`);

            Logger.log(`EXPORT: '${user.username}' exported data in CSV format.`)
            return stringify(sourceData, { header: true }).pipe(res);
        }
    } catch (err) {
        Logger.log(`EXPORT ERROR: Failed to export data and send response; error: ${err}`);
    }
})

module.exports = { router, at: "/" }