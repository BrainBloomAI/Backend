const { default: OpenAI } = require('openai');
const Cache = require('./Cache');
require('dotenv').config();

/**
 * OpenAIChat is a class that provides a simple interface to OpenAI's Chat API.
 * 
 * The class provides a method to initialise the OpenAI client, and a method to prompt the model with a message. The class must be initialised before prompt messages are run.
 * 
 * In the prompt method, set `insertAppContext` to `true` to insert the app context before the user message.
 * 
 * Example usage:
 * ```js
 * const initialisationResult = OpenAIChat.initialise();
 * if (initialisationResult !== true) {
 *    console.log(initialisationResult);
 *    process.exit();
 * }
 * 
 * (async () => {
 *    const message = await OpenAIChat.prompt(
 *        "What's MakanMatch?",
 *        true,
 *        [
 *            {
 *                role: "user",
 *                content: "my name is sally!"
 *            },
 *            {
 *                role: "assistant",
 *                content: "Hi Sally! How may I help you?"
 *            }
 *        ]
 *    )
 *    console.log(message.content);
 * })();
 * ```
 * 
 * @method initialise() - Initialises the OpenAI client with the API key from the environment variables. Returns true if successful, or an error message if unsuccessful.
 * @method prompt(message, insertAppContext=false, history=[]) - Prompts the OpenAI model with a message. If `insertAppContext` is true, the app context will be inserted before the user message. The `history` parameter is an array of messages that have been sent in the conversation. Returns the response from the model.
 */
class OpenAIChat {
    /**
     * @type {OpenAI}
     */
    static initialised = false;
    static client;
    static model = "gpt-4o-mini";
    static maxTokens = 512;
    static temperature = 0.5;

    static appContext() {
        return [
            
        ]
    }

    static checkPermission() {
        return process.env.OPENAI_CHAT_ENABLED === 'True'
    }

    static initialise(configOptions={ model: "gpt-4o-mini", maxTokens: 512, temperature: 0.5 }) {
        if (!this.checkPermission()) {
            return "ERROR: OpenAIChat operation permission denied.";
        }

        try {
            this.client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        } catch (err) {
            return `ERROR: OpenAIChat failed to initialise. Error; ${err}`;
        }

        if (configOptions.model) {
            this.model = configOptions.model;
        }
        if (configOptions.maxTokens) {
            this.maxTokens = configOptions.maxTokens;
        }
        if (configOptions.temperature) {
            this.temperature = configOptions.temperature;
        }

        this.initialised = true;
        return true;
    }

    static async prompt(message, insertAppContext=false, history=[]) {
        if (!this.checkPermission() || !this.client) {
            return "ERROR: OpenAIChat not initialised properly."
        }

        // Sanitise history
        const sanitisedMessages = []
        if (insertAppContext) {
            for (const message of this.appContext()) {
                sanitisedMessages.push(message);
            }
        }
        for (const message of history) {
            if (typeof message !== "object") {
                continue;
            } else if (!message.hasOwnProperty("role") || !message.hasOwnProperty("content")) {
                continue;
            } else if (typeof message.role !== "string" || typeof message.content !== "string") {
                continue;
            } else {
                sanitisedMessages.push(message);
            }
        }

        sanitisedMessages.push({
            role: "user",
            content: message
        })

        // Run prompt
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: sanitisedMessages,
                max_tokens: this.maxTokens,
                temperature: this.temperature
            })

            return response.choices[0].message;
        } catch (err) {
            return `ERROR: Failed to run prompt. Error: ${err}`
        }
    }
}



module.exports = OpenAIChat;