require('dotenv').config()

/**
 * BootCheck class to check if all required environment variables are set
 * 
 * Add required environment variables to the `requiredVariables` array. You can add additional checks of your own in the for loop.
 * 
 * Add optional environment variables to the `optionalVariables` array. The class will check if they are set and log a warning if they are not.
 * 
 * @method check: Checks if all required environment variables are set
 */
class BootCheck {
    static check() {
        let requiredVariables = ["SERVER_PORT", "DB_MODE", "OPENAI_CHAT_ENABLED", "OPENAI_API_KEY", "FIRESTORAGE_ENABLED", "STORAGE_BUCKET_URL", "FILEMANAGER_ENABLED", "SUPER_KEY", "AI_MODEL"]
        for (let variable of requiredVariables) {
            if (process.env[variable] === undefined) {
                throw new Error(`Environment variable ${variable} is not set.`)
            }
            
            if (variable == "DB_MODE" && process.env[variable] !== "mysql" && process.env[variable] !== "sqlite") {
                throw new Error(`Environment variable ${variable} is not set to 'mysql' or 'sqlite'.`)
            } else if (variable == "DB_MODE" && process.env[variable] == "mysql") {
                requiredVariables.push("DB_CONFIG")
            }

            if (variable == "DB_CONFIG") {
                const config = require('../config/config.json')[process.env.DB_CONFIG]
                if (config === undefined) {
                    throw new Error(`Chosen database configuration ${process.env.DB_CONFIG} is not found in config/config.json.`)
                }
            }

            if (variable == "AI_MODEL" && !(["gpt", "nvidia"].includes(process.env[variable]))) {
                throw new Error(`'AI_MODEL' environment variable must be set to either 'gpt' or 'nvidia'.`)
            }
        }

        let optionalVariables = ["LOGGING_ENABLED", "DEBUG_MODE", "FILEMANAGER_MODE", "OPENAI_ENFORCE_EASY_DIFFICULTY"]
        for (let variable of optionalVariables) {
            if (process.env[variable] !== undefined) {
                optionalVariables = optionalVariables.filter(v => v !== variable)
            }
        }
        if (optionalVariables.length > 0) {
            console.log(`BOOTCHECK WARNING: Optional environment variable(s) ${optionalVariables.join(", ")} are not set.`)
        }
    }
}

module.exports = BootCheck;