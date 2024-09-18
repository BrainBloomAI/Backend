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
        Logger.log(`EXPORT ERROR: Failed to read full data for export; error: ${err}`);
        return res.status(500).send('ERROR: Failed to process request.')
    }

    // Do additional parameter-based data processing
    try {
        fullSourceJSON = await Promise.all(fullSourceJSON.map(async user => {
            user.banned = user.banned ? "Yes" : "No";

            user.playedGames.sort((a, b) => {
                return new Date(a.startedTimestamp) - new Date(b.startedTimestamp)
            });

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
        } else {
            var textContent = `BrainBloomAI Textual Export
Upon request by staff '${user.username}' on ${new Date().toString()}.

How this file is structured:
- Scenarios (if included)
- User data
    - Aggregate performance across AI evaluations of games (if included)
- Games data (if included)
    - Evaluation data (if included)
    - Dialogues data (if included)

Scenarios are the backdrops/settings/contexts for the games in BrainBloomAI.
They are managed by staff, and are used by the AI sub-system to generate interactions with the user.

User accounts are central to the BrainBloomAI system.
They are the parents of all data, and thus are the primary entities.

MINDS staff can key in additional metrics for each user, after conducting a verified in-person evaluation of the PWID.
These metrics help digitise and store the PWID's official MINDS evaluation data, and also help personalise gameplay.

Games are AI-generated interactions which can either be ongoing, complete or abandoned.
They are the primary parent entities of dialogues, attempts and evaluations.

Dialogues are a specific interaction from either the user or the system.
Each dialogue can have many attempts. A game will always have only 8 dialogues.
Dialogues are only successful when one of their attempts is successful.

Attempts are the individual attempts for a dialogue. They are the lowest level of interaction in BrainBloomAI.
Attempts are only successful when the user's response is contextually appropriate, as deemed by the AI sub-system.

Evaluations are conducted by the AI sub-system after a game is completed.
The AI assesses the user based on the same metrics as the MINDS staff, and provides some simple feedback for the user, and comprehensive feedback for the staff.
In some cases, completed games may not have associated evaluations, due to system errors or other issues.

--- START OF DATA ---

`;

            if (includeScenarios) {
                const scenarios = (await Scenario.findAll()).map(s => s.toJSON());
                scenarios.forEach(scenario => {
                    textContent += `--- Scenario ---
Scenario ID: ${scenario.scenarioID}
Name: ${scenario.name}
Description: ${scenario.description}
System's Role: ${scenario.modelRole}
User's Role: ${scenario.userRole}
Created: ${new Date(scenario.created).toString()}

`
                })
            }

            for (const user of formattedJSON) {
                textContent += `--- User ---
User ID: ${user.userID}
Username: ${user.username}
Email: ${user.email}
Role: ${user.role}
Points: ${user.points}
Account Created: ${new Date(user.created).toString()}
Last Login: ${new Date(user.lastLogin).toString()}
Banned: ${user.banned}

MINDS Listening Metric: ${user.mindsListening || "Not available"}
MINDS EQ Metric: ${user.mindsEQ || "Not available"}
MINDS Tone Metric: ${user.mindsTone || "Not available"}
MINDS Helpfulness Metric: ${user.mindsHelpfulness || "Not available"}
MINDS Clarity Metric: ${user.mindsClarity || "Not available"}
MINDS Assessment: ${user.mindsAssessment || "Not available"}

`

                if (computePerformance) {
                    textContent += `Aggregate Listening Score: ${user.aggregatePerformance?.listening || "Not available"}
Aggregate EQ Score: ${user.aggregatePerformance?.eq || "Not available"}
Aggregate Tone Score: ${user.aggregatePerformance?.tone || "Not available"}
Aggregate Helpfulness Score: ${user.aggregatePerformance?.helpfulness || "Not available"}
Aggregate Clarity Score: ${user.aggregatePerformance?.clarity || "Not available"}

`
                }

                if (includeGames && user.playedGames) {
                    user.playedGames.forEach(game => {
                        textContent += `--- Game ---
Game ID: ${game.gameID}
User: ${user.username}
Scenario Name: ${game.scenarioName}
Started At: ${new Date(game.startedTimestamp).toString()}
Status: ${game.status}
Points Earned: ${game.pointsEarned || "Not available"}

`

                        if (includeEvaluations && game.evaluation) {
                            textContent += `--- Evaluation ---
Evaluation ID: ${game.evaluation.evaluationID}
Game ID: ${game.gameID}
Listening Score: ${game.evaluation.listening}%
EQ Score: ${game.evaluation.eq}%
Tone Score: ${game.evaluation.tone}%
Helpfulness Score: ${game.evaluation.helpfulness}%
Clarity Score: ${game.evaluation.clarity}%
Simple Feedback for User: ${game.evaluation.simpleDescription}
Full Assessment for Staff: ${game.evaluation.fullDescription}

`
                        }

                        if (includeDialogues && game.dialogues) {
                            game.dialogues.forEach(dialogue => {
                                textContent += `--- Dialogue ---
Dialogue ID: ${dialogue.dialogueID}
Game ID: ${game.gameID}
By: ${dialogue.by}
Attempts: ${dialogue.attemptsCount}
Successful: ${dialogue.successful}
Created At: ${new Date(dialogue.createdTimestamp).toString()}

`

                                if (dialogue.attempts) {
                                    dialogue.attempts.forEach(attempt => {
                                        textContent += `--- Attempt ${attempt.attemptNumber} ---
Attempt ID: ${attempt.attemptID}
Dialogue ID: ${dialogue.dialogueID} (By: ${dialogue.by})
Attempt Number: ${attempt.attemptNumber}
Content: ${attempt.content}
Successful: ${attempt.successful}
Time Taken: ${attempt.timeTaken} seconds
Timestamp: ${new Date(attempt.timestamp).toString()}

`
                                    })
                                }
                            })
                        }
                    })
                }
            }

            textContent += `--- END OF DATA ---`;

            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="BrainBloomAIExport.txt"`);

            Logger.log(`EXPORT: '${user.username}' exported data in text format.`)
            return res.send(textContent);
        }
    } catch (err) {
        Logger.log(`EXPORT ERROR: Failed to export data and send response; error: ${err}`);
    }
})

module.exports = { router, at: "/" }