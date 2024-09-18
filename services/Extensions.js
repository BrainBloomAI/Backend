const { Model } = require("sequelize");

class Extensions {
    /**
     * Filter a dictionary with a predicate.
     * Example Usage: `Extensions.filterDictionary(dictionary, (key, value) => key.startsWith('a'))`
     * @param {object} dictionary 
     * @param {function(string, string)} predicate 
     * @returns object
     */
    static filterDictionary = (dictionary, predicate) => {
        return Object.fromEntries(Object.entries(dictionary).filter(([k, v]) => predicate(k, v)))
    }

    /**
     * 
     * @param {Date} beforeDate 
     * @param {Date} afterDate 
     * @returns {number}
     */
    static timeDiffInSeconds(beforeDate, afterDate) {
        return (afterDate.getTime() - beforeDate.getTime()) / 1000;
    }

    static sanitiseData(data, allowedKeys = [], disallowedKeys = [], allowedTopLevelKeys = []) {
        if (allowedKeys.length == 0 && disallowedKeys.length == 0 && allowedTopLevelKeys.length == 0) { return data }
        var dataToReturn = {}
        for (let attribute of Object.keys(data)) {
            if (allowedTopLevelKeys.includes(attribute)) {
                // Key is an explicitly allowed top-level key
                dataToReturn[attribute] = data[attribute]
            } else if (disallowedKeys.includes(attribute)) {
                // Key is an explicitly disallowed attribute
                continue
            } else if (Array.isArray(data[attribute])) {
                // Key has an array as a value
                var sanitisedArray = []
                for (let item of data[attribute]) {
                    if (item instanceof Object) {
                        // Array item is an dictionary
                        sanitisedArray.push(Extensions.sanitiseData(item, allowedKeys, disallowedKeys, allowedTopLevelKeys))
                    } else {
                        // Array item is a regular item
                        sanitisedArray.push(item)
                    }
                }
                dataToReturn[attribute] = sanitisedArray
            } else if (data[attribute] instanceof Object) {
                // Key has a dictionary as a value
                dataToReturn[attribute] = Extensions.sanitiseData(data[attribute], allowedKeys, disallowedKeys, allowedTopLevelKeys)
            } else {
                if (allowedKeys.length == 0 || allowedKeys.includes(attribute)) {
                    // Key is either explicitly allowed or was not explicitly disallowed
                    dataToReturn[attribute] = data[attribute]
                }
            }
        }
        return dataToReturn
    }

    /**
     * 
     * @param {Model} scenario 
     */
    static prepScenarioForAI(scenario) {
        return {
            description: {
                name: scenario.name,
                fullDescription: scenario.description
            },
            roles: {
                modelRole: scenario.modelRole,
                userRole: scenario.userRole
            }
        }
    }

    /**
     * 
     * @param {Model} fullGame 
     */
    static prepGameDialogueForAI(fullGame, mapToScenarioRoles = true, includeFailedAttempts = false) {
        const sortedDialogues = fullGame.dialogues.map(d => d.toJSON()).sort((a, b) => {
            return new Date(a.createdTimestamp) - new Date(b.createdTimestamp)
        })

        var conversationLog = []
        sortedDialogues.forEach(dialogue => {
            if (!includeFailedAttempts) {
                const successfulAttempt = dialogue.attempts.find(a => a.successful)
                if (successfulAttempt) {
                    conversationLog.push({
                        by: mapToScenarioRoles ? (dialogue.by == 'user' ? fullGame.scenario.userRole : fullGame.scenario.modelRole) : dialogue.by,
                        content: successfulAttempt.content
                    })
                }
            } else {
                const sortedAttempts = dialogue.attempts.sort((a, b) => {
                    return new Date(a.timestamp) - new Date(b.timestamp)
                })
                sortedAttempts.forEach(attempt => {
                    conversationLog.push({
                        by: mapToScenarioRoles ? (dialogue.by == 'user' ? fullGame.scenario.userRole : fullGame.scenario.modelRole) : dialogue.by,
                        content: attempt.content
                    })
                })
            }
        })

        return conversationLog
    }

    /**
     * 
     * @param {Model} user
     */
    static async computeAggregatePerformance(user) {
        const games = (await user.getPlayedGames({
            include: [
                {
                    model: GameEvaluation,
                    as: "evaluation"
                }
            ]
        })).filter(g => g.evaluation != null);

        // In the event that a user has no evaluations, try to return MINDS evaluation data
        if (games.length == 0) {
            if (user.mindsListening && user.mindsEQ && user.mindsTone && user.mindsHelpfulness && user.mindsClarity) {
                return {
                    listening: user.mindsListening,
                    eq: user.mindsEQ,
                    tone: user.mindsTone,
                    helpfulness: user.mindsHelpfulness,
                    clarity: user.mindsClarity
                }
            } else {
                return null;
            }
        }

        var listeningTotal = 0;
        var eqTotal = 0;
        var toneTotal = 0;
        var helpfulnessTotal = 0;
        var clarityTotal = 0;
        games.forEach(g => {
            listeningTotal += g.evaluation.listening;
            eqTotal += g.evaluation.eq;
            toneTotal += g.evaluation.tone;
            helpfulnessTotal += g.evaluation.helpfulness;
            clarityTotal += g.evaluation.clarity;
        })
        return {
            listening: Math.round((listeningTotal / games.length) * 100) / 100,
            eq: Math.round((eqTotal / games.length) * 100) / 100,
            tone: Math.round((toneTotal / games.length) * 100) / 100,
            helpfulness: Math.round((helpfulnessTotal / games.length) * 100) / 100,
            clarity: Math.round((clarityTotal / games.length) * 100) / 100
        }
    }

    static flattenScenarioDataForCSV(scenario) {
        return [{
            ScenarioID: scenario.scenarioID,
            ScenarioName: scenario.name,
            ScenarioDescription: scenario.description,
            ScenarioModelRole: scenario.modelRole,
            ScenarioUserRole: scenario.userRole,
        }]
    }

    static flattenUserDataForCSV(user) {
        var rows = []

        // Add in user data first, and establish all headers
        rows.push({
            Username: user.username,
            UserEmail: user.email,
            UserRole: user.role,
            UserPoints: user.points,
            UserCreated: user.created,
            UserLastLogin: user.lastLogin,
            UserMindsListening: user.mindsListening,
            UserMindsEQ: user.mindsEQ,
            UserMindsTone: user.mindsTone,
            UserMindsHelpfulness: user.mindsHelpfulness,
            UserMindsClarity: user.mindsClarity,
            UserMindsAssessment: user.mindsAssessment,
            UserBanned: user.banned,
            ScenarioID: null,
            ScenarioName: null,
            ScenarioDescription: null,
            ScenarioModelRole: null,
            ScenarioUserRole: null,
            GameID: null,
            GameScenario: null,
            GameStartedTimestamp: null,
            GameStatus: null,
            GamePointsEarned: null,
            DialogueID: null,
            DialogueBy: null,
            DialogueAttempts: null,
            DialogueSuccess: null,
            DialogueCreatedTimestamp: null,
            AttemptID: null,
            AttemptNumber: null,
            AttemptContent: null,
            AttemptSuccess: null,
            AttemptTimestamp: null,
            AttemptTimeTaken: null,
            EvaluationID: null,
            EvaluationListening: null,
            EvaluationEQ: null,
            EvaluationTone: null,
            EvaluationHelpfulness: null,
            EvaluationClarity: null,
            EvaluationSimpleDescription: null,
            EvaluationFullDescription: null
        })

        // Loop through played games
        user.playedGames.forEach(game => {
            // Add in high-level game information
            var gameRowObject = {
                Username: user.username,
                GameID: game.gameID,
                GameScenario: game.scenario.name,
                GameStartedTimestamp: game.startedTimestamp,
                GameStatus: game.status,
                GamePointsEarned: game.pointsEarned
            }
            if (game.evaluation) {
                gameRowObject.EvaluationID = game.evaluation.evaluationID
                gameRowObject.EvaluationListening = game.evaluation.listening
                gameRowObject.EvaluationEQ = game.evaluation.eq
                gameRowObject.EvaluationTone = game.evaluation.tone
                gameRowObject.EvaluationHelpfulness = game.evaluation.helpfulness
                gameRowObject.EvaluationClarity = game.evaluation.clarity
                gameRowObject.EvaluationSimpleDescription = game.evaluation.simpleDescription
                gameRowObject.EvaluationFullDescription = game.evaluation.fullDescription
            }

            rows.push(gameRowObject)

            game.dialogues.forEach(dialogue => {
                // Add in high-level dialogue information
                rows.push({
                    Username: user.username,
                    GameID: game.gameID,
                    DialogueID: dialogue.dialogueID,
                    DialogueBy: dialogue.by,
                    DialogueAttempts: dialogue.attemptsCount,
                    DialogueSuccess: dialogue.successful,
                    DialogueCreatedTimestamp: dialogue.createdTimestamp,
                })

                dialogue.attempts.forEach(attempt => {
                    // Add in high-level attempt information
                    rows.push({
                        Username: user.username,
                        GameID: game.gameID,
                        DialogueID: dialogue.dialogueID,
                        AttemptID: attempt.attemptID,
                        AttemptNumber: attempt.attemptNumber,
                        AttemptContent: attempt.content,
                        AttemptSuccess: attempt.successful,
                        AttemptTimestamp: attempt.timestamp,
                        AttemptTimeTaken: attempt.timeTaken,
                    })
                })
            })
        })

        return rows;
    }
}

module.exports = Extensions;