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
    static prepGameDialogueForAI(fullGame, mapToScenarioRoles=true) {
        const sortedDialogues = fullGame.dialogues.map(d => d.toJSON()).sort((a, b) => {
            return new Date(a.createdTimestamp) - new Date(b.createdTimestamp)
        })

        var conversationLog = []
        sortedDialogues.forEach(dialogue => {
            const successfulAttempt = dialogue.attempts.find(a => a.successful)
            if (successfulAttempt) {
                conversationLog.push({
                    by: mapToScenarioRoles ? (dialogue.by == 'user' ? fullGame.scenario.userRole : fullGame.scenario.modelRole) : dialogue.by,
                    content: successfulAttempt.content
                })
            }
        })

        return conversationLog
    }
}

module.exports = Extensions;