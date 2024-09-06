const { default: OpenAI } = require('openai');
const Cache = require('./Cache');
require('dotenv').config()

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
            {
                role: "system",
                content: "You are a helpful assistant simulating real-life scenarios for people with intellectual disabilities."
            }
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





    // Generate an initial message based on a scenario
    static async generateInitialMessage(scenario, modelRole) {
        const prompt = `Generate a realistic opening line spoken by the ${modelRole} in a conversation based on this scenario: ${scenario}.`;
        return await this.prompt(prompt, true);
    }


    // Evaluate if the user's response is appropriate and relevant
    static async evaluateResponse(scenario, conversation, response) {
        const prompt = `Evaluate if the user's response: "${response}" is both appropriate and relevant to this scenario: "${scenario}", as a response to the last line in the conversation so far: ${JSON.stringify(conversation)}. Respond with a boolean value.`; 
        const evaluation = await this.prompt(prompt, true);
        return evaluation.content.trim().toLowerCase() === 'true';
    }


    // Generate an ideal response to the last message
    static async generateIdealResponse(scenario, conversation, userRole, modelRole) {
        const prompt = `Given the scenario: "${scenario}" and the following conversation: ${JSON.stringify(conversation)}, generate the ideal response to the last thing said by the ${modelRole}, that should be said by the ${userRole}.`;
        return await this.prompt(prompt, true, conversation);
    }


    // Generate the next message in conversation based on user's response
    static async generateNextMessage(scenario, conversation, modelRole) {
        const prompt = `Considering this scenario: "${scenario}" and the current conversation: ${JSON.stringify(conversation)}, generate the next message that should be spoken by the ${modelRole}.`;
        return await this.prompt(prompt, true, conversation);
    }


    // Check if the response is similar to the ideal response
    static async checkResponseSimilarity(response, idealResponse) {
        const prompt = `Compare the user's response: "${response}" with the ideal response: "${idealResponse}". Provide a similarity score between 0 and 100, where 100 is the closest match.`;
        const similarityScore = await this.prompt(prompt, true);
        return parseInt(similarityScore.content, 10) > 75;
    }


    // Generating the final message to wrap up the conversation
    static async generateFinalMessage(scenario, conversation, modelRole) {
        const prompt = `Based on the scenario: "${scenario}" and the conversation so far: ${JSON.stringify(conversation)}, generate a final message from the ${modelRole} to conclude the conversation in a nice and friendly manner.`;
        return await this.prompt(prompt, true, conversation);
    }


    // Final evaluation for the conversation based on metrics
    static async evaluateConversation(conversation, userRole) {
        const prompt = `Evaluate this conversation: ${JSON.stringify(conversation)} based on the responses of the ${userRole}. Evaluate the user on:
            1. Listening/Comprehension
            2. Emotional Intelligence (EQ)
            3. Tone appropriateness
            4. Helpfulness
            5. Clarity
        Respond with percentage scores for each metric and provide both a short and long description of the evaluation.`;

        return await this.prompt(prompt, true);
    }



    

}



module.exports = OpenAIChat;