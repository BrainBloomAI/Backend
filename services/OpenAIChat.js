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



    // Generative Functions


    // Generate an initial message based on a scenario
    static async generateInitialMessage(scenario) {
        // initalise the scenario var
        const prompt = `
        You are role-playing as a ${scenario.roles.modelRole} interacting with a ${scenario.roles.userRole} in a scenario designed for persons with intellectual disabilities.
        The scenario is described as: "${scenario.description.fullDescription}".
        Your job is to initiate a conversation with the ${scenario.roles.userRole} in a clear way. 
        The scenario is focused on teaching communication skills to reduce social isolation and foster inclusion in a ${scenario.description.tag} environment.
        Please generate a simple and polite first message that the ${scenario.roles.modelRole} would say in this context to start the conversation.`;
    
        const initialMessage = await OpenAIChat.prompt(prompt, true);
        return initialMessage;
    }

    // Generate an ideal response to the last message
    static async generateIdealResponse(conversationHistory, scenario) {
        const lastSystemMessage = conversationHistory.conversationLog
            .filter(message => message.by === scenario.roles.modelRole)
            .slice(-1)[0];  // Get the last system message
    
        const prompt = `
            You are role-playing as a ${scenario.roles.userRole} in a ${scenario.description.name} scenario. 
            The ${scenario.roles.modelRole} has said: "${lastSystemMessage.content}".
            This scenario is for a person with intellectual disabilities to learn appropriate communication in real-life settings.
            Generate an ideal response that is clear, polite, and relevant to what the ${scenario.roles.modelRole} last said in this context.
        `;
        
        const idealResponse = await OpenAIChat.prompt(prompt, true);
        return idealResponse;
    }

    // Generate the next message in conversation based on user's response
    static async generateNextMessage(conversationHistory, scenario) {
        // Get the last message from the userRole
        const lastUserMessage = conversationHistory.conversationLog
            .filter(message => message.by === scenario.roles.userRole)  // Get all messages by the user
            .slice(-1)[0];  // Get the last message
        
        if (!lastUserMessage) {
            throw new Error('No user message found in conversation history.');
        } else {
            console.log(lastUserMessage);
        }


        const prompt = `
        You are role-playing as a ${scenario.roles.modelRole} in a ${scenario.description.name} scenario where the ${scenario.roles.userRole} is assisting you.
        The ${scenario.roles.userRole} (a person with intellectual disabilities) has just said: "${lastUserMessage.content}".
        Please generate a polite, clear, and socially appropriate response that a ${scenario.roles.modelRole} would say in this situation to continue the conversation.
        The context of this scenario is: "${scenario.description.fullDescription}".`;
    
        const nextMessage = await OpenAIChat.prompt(prompt, true);
        console.log(nextMessage);
        return nextMessage;
    }




    // Evaluate Functions

    // Evaluate if the user's response is appropriate and relevant
    static async evaluateResponse(conversationHistory, scenario) {
        const lastSystemMessage = conversationHistory.conversationLog
            .filter(message => message.by === scenario.roles.modelRole)
            .slice(-1)[0];  // Get the last system message
        
        console.log(lastSystemMessage);
        
        const prompt = `
            In this ${scenario.description.tag} scenario, the ${scenario.roles.userRole} (a person with intellectual disabilities) has responded with: "${conversationHistory.targetAttempt}"
            to the last message: "${lastSystemMessage.content}". 
            The goal of the scenario is to teach the ${scenario.roles.userRole} how to communicate appropriately in social interactions.
            Evaluate whether this response is relevant, clear, and socially appropriate in this ${scenario.description.name} context.
            Respond with "true" if it is appropriate, or "false" if it is not.
        `;
        
        const evaluation = await OpenAIChat.prompt(prompt, true);
        console.log(evaluation);
        return evaluation.content === 'True';
    }


    // Final evaluation for the conversation based on metrics
    static async evaluateConversation(conversationHistory, scenario) {
        const prompt = `
            Evaluate this conversation between a ${scenario.roles.userRole} (a person with intellectual disabilities) and a ${scenario.roles.modelRole} in a ${scenario.description.tag} scenario.
            The goal is to teach the ${scenario.roles.userRole} how to respond in real-life social situations to reduce social isolation and promote community inclusion.
            Please evaluate the following metrics:
            - Listening and comprehension (did the user understand the customer’s needs?)
            - Emotional intelligence (EQ)
            - Tone appropriateness (was the user's tone polite and inclusive?)
            - Helpfulness (did the user respond helpfully?)
            - Clarity (was the response clear and easy to understand?)
            
            Provide percentage scores for each area and give:
            - A simple, short description of the user’s performance (for user feedback)
            - A detailed description of the user’s performance (for staff feedback)
            
            Conversation history: ${JSON.stringify(conversationHistory.conversationLog)}
        `;
        
        const evaluation = await OpenAIChat.prompt(prompt, true);
        console.log(evaluation);
        return evaluation;
    }



    

}



module.exports = OpenAIChat;