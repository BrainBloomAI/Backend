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

    static async generateScript(prompt) {
        const response = await this.prompt(prompt, true);
        return response.content.trim().split("\n");
    }

    static async evaluateResponse(userResponse, expectedResponse) {
        const prompt = `Given the user response:\n"${userResponse}"\nAnd the expected response:\n"${expectedResponse}"\nEvaluate if the user response is appropriate for the scenario. Provide a yes or no answer.`;
        const evaluation = await this.prompt(prompt);
        return evaluation.content.toLowerCase().includes("yes");
    }

    // temp function to get user input form console
    // static async getUserInput(promptText) {
    //     return new Promise((resolve) => {
    //         this.r1.question(promptText, (answer) => {
    //             resolve(answer);
    //         });
    //     });
    // }

    // static async scenarioRunner() {
    //     // Generate the interaction script
    //     const script = await this.generateScript("Generate a realistic interaction between a customer and a retail worker. Each should say 3 lines, starting with the customer.");
        
    //     // Start the count
    //     while (scriptIndex < script.length) {
    //         if (scriptIndex % 2 === 0) {
    //             // Send the character's line
    //             console.log('Customer: ${script[scriptIndex]}');
    //         } else {
    //             // Get user's response
    //             const expectedResponse = script[scriptIndex];

    //             const timer = new Promise((resolve) => {
    //                 setTimeout(() => {
    //                     resolve("User took too long to respond.");
    //                 }, 10000); // 10 seconds
    //             });

    //             const userInputPromise = this.getUserInput('Retail Worker (you): ');
    //             const userResponse = await Promise.race([timer, userInputPromise]);

    //             if (userResponse === "User took too long to respond.") {
    //                 console.log('Suggested Response: ${expectedResponse}');
    //                 continue;
    //             }


    //             // Check if the user's answer makes sense
    //             const isValid = await this.evaluateResponse(userResponse, expectedResponse);
    //             if (!isValid) {
    //                 // Ask to re-enter the appropriate response
    //                 console.log("That response doesn't seem right.\nSuggested Response: ${expectedResponse}");
    //                 const retryResponse = await this.getUserInput("Try again: ");
    //                 const isRetryValid = await this.evaluateResponse(retryResponse, expectedResponse);
    //                 if (!isRetryValid) {
    //                     // If still invalid response, the ideal response is used for them
    //                     console.log('Invalid Response. Using Suggested Response: ${expectedResponse}');
    //                 } else {
    //                     script[scriptIndex] = retryResponse;
    //                 }
    //             } else {
    //                 script[scriptIndex] = userResponse;
    //             }
    //         }
    //         scriptIndex++;
    //     }

    //     console.log("Interaction complete.");
    //     this.r1.close();
    // }
}

// (async () => {
//     const initialisationResult = await OpenAIChat.initialise();
//     if (!initialisationResult) {
//         console.log("Failed to initialize OpenAIChat.");
//         process.exit();
//     }

//     console.log("Scenario selected: Retail Worker interacting with a customer");
//     await OpenAIChat.scenarioRetailWorker();
// })();

module.exports = OpenAIChat;