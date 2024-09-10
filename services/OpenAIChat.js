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

    static appContext(scenario) {
        return [
            {
                role: "system",
                content: `You are a helpful assistant simulating real-life scenarios for people with intellectual disabilities. 
                The purpose of this interaction is to help them develop communication skills that promote social inclusion. 
                You will take on the role of "${scenario.roles.modelRole}", and the user will be playing the role of "${scenario.roles.userRole}". 
                The scenario is set in: "${scenario.description.name}". The focus is: "${scenario.description.fullDescription}". 
                
                Your goal is to guide the user in this role-play by being polite, clear, and providing appropriate feedback when necessary. 
                Make sure your responses are brief, simple, and easy to understand. Avoid using complex words or long sentences. 
                Keep responses under 3 sentences, and ensure they can be easily understood by someone with an intellectual disability.`
            }
        ];
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

    static async prompt(message, scenario, insertAppContext=false, history=[]) {
        if (!this.checkPermission() || !this.client) {
            return "ERROR: OpenAIChat not initialised properly."
        }

        // Sanitise history
        const sanitisedMessages = []
        if (insertAppContext) {
            for (const message of this.appContext(scenario)) {
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
        const prompt = `
        Initiate the conversation with me (${scenario.roles.userRole}) as ${scenario.roles.modelRole}.
        `;
        return await OpenAIChat.prompt(prompt, scenario, true);
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
            Limit the length of the response to something that will be easy to repeat.
            Please provide only the message content without any extra information or formatting, ensure that the response is by ${scenario.roles.userRole}.
        `;
        
        return await OpenAIChat.prompt(prompt, scenario, true);
    }

    // Generate the wrap up message for the conversation
    static async generateWrapUpMessage(conversationHistory, scenario) {
        const prompt = `
        You are role-playing as a ${scenario.roles.modelRole} in a ${scenario.description.name} scenario where the ${scenario.roles.userRole} (user) is assisting you.
        The goal of this scenario is to simulate a real-life situation to help the user develop communication skills for social inclusion.
        The context of this scenario is: "${scenario.description.fullDescription}".
        The interaction is at its end now and needs to be wrapped up.

        Here is the full conversation history:
        ${conversationHistory.conversationLog.map((message) => {
            return `${message.by}: ${message.content}`;
        }).join('\n')}
        
        As the ${scenario.roles.modelRole}, generate a polite, clear, and socially appropriate response that ends the conversation naturally without repeating information already mentioned. 
        Your response should stay within the context of the conversation, and be easy to understand. 
        Avoid introducing complex language or redundant points, and keep the it short and easy to understand for people with intellectual disabilities.
        
        Provide response content only without any extra information or formatting.

        ${scenario.roles.modelRole} (You):
        `;

        const finalMessage = await OpenAIChat.prompt(prompt, scenario, true);
        return finalMessage;
    }

    // Generate the next message in conversation based on user's response
    static async generateNextMessage(conversationHistory, scenario) {
        // Get the last message from the userRole
        const lastUserMessage = conversationHistory.conversationLog
            .filter(message => message.by === scenario.roles.userRole)  // Get all messages by the user
            .slice(-1)[0];  // Get the last message
    
        const prompt = `
        You are role-playing as a ${scenario.roles.modelRole} in a ${scenario.description.name} scenario where the ${scenario.roles.userRole} (user) is assisting you.
        The goal of this scenario is to simulate a real-life situation to help the user develop communication skills for social inclusion.
        The context of this scenario is: "${scenario.description.fullDescription}".

        Here is the conversation history so far:
        ${conversationHistory.conversationLog.map((message) => {
            return `${message.by}: ${message.content}`;
        }).join('\n')}
        
        As the ${scenario.roles.modelRole}, generate a polite, clear, and socially appropriate response that progresses the conversation naturally without repeating information already mentioned. 
        Your response should stay within the context of the conversation, encourage continued engagement, and be easy to understand. 
        Avoid introducing complex language or redundant points, and keep the it short and easy to understand for people with intellectual disabilities. 
        Ensure the conversation stays relevant and helpful.
        
        Provide response content only without any extra information or formatting.

        ${scenario.roles.modelRole} (You):
        `;

        const nextMessage = await OpenAIChat.prompt(prompt, scenario, true);
        return nextMessage;
    }



    // Evaluate Functions

    // Evaluate if the user's response is appropriate and relevant
    static async evaluateResponse(conversationHistory, scenario) {
        const lastSystemMessage = conversationHistory.conversationLog
            .filter(message => message.by === scenario.roles.modelRole)
            .slice(-1)[0];  // Get the last system message
        
        const prompt = `
            You are evaluating a response in a ${scenario.description.name} scenario. The scenario is described as: "${scenario.description.fullDescription}".
            
            Here is the conversation history:
            ${conversationHistory.conversationLog.map((message) => `${message.by}: ${message.content}`).join('\n')}
            
            The goal of this scenario is to help the ${scenario.roles.userRole} (the user, who has intellectual disabilities) learn how to communicate appropriately and effectively.
            
            The ${scenario.roles.modelRole} (you) last said: "${lastSystemMessage.content}"
            The ${scenario.roles.userRole} has responded with: "${conversationHistory.targetAttempt}"
            
            Consider whether the response from the ${scenario.roles.userRole} is appropriate, relevant, clear, and socially suitable in the context of the entire conversation and scenario.
            
            Respond with "true" if the response is appropriate, or "false" if it is not. 
            Ensure your response is based on the overall context and communication goals described.
            In addition, be more lenient in your evaluation given that the user has intellectual disabilities.
            Provide only "True" or "False" in your answer.
        `;
        
        const evaluation = await OpenAIChat.prompt(prompt, scenario, true);
        console.log(evaluation.content);
        return evaluation.content === 'True';
    }


    // Final evaluation for the conversation based on metrics
    static async evaluateConversation(conversationHistory, scenario) {
    
        const prompt = `
            Evaluate this conversation between a user (a person with intellectual disabilities) and a ${scenario.roles.modelRole} in a ${scenario.description.tag} scenario.
            The goal is to teach the user how to respond in real-life social situations to reduce social isolation and promote community inclusion.
            Provide a balanced evaluation with constructive feedback.
    
            Please evaluate the following five metrics, providing an exact percentage score for each:
            1. Listening and comprehension (did the user understand the customer’s needs?)
            2. Emotional intelligence (EQ)
            3. Tone appropriateness (was the user's tone polite and inclusive?)
            4. Helpfulness (did the user respond helpfully?)
            5. Clarity (was the response clear and easy to understand?)

            In addition:
            - Provide a simple, short description of the user’s performance for user feedback.
            - Provide a detailed description of the user’s performance for staff feedback. Given that the staff are trained at dealing with people with intellectual disabiliteis, include detailed and constructive feedback for the staff to further teach the users for future interactions. Respond as if telling directly to the staff. Return as a paragraph.
    
            Provide the results separated by a pipe (|) symbol, without spaces or the label, in the following order:
            - Listening and comprehension: [percentage]%
            - Emotional intelligence: [percentage]%
            - Tone appropriateness: [percentage]%
            - Helpfulness: [percentage]%
            - Clarity: [percentage]%
            - User Feedback: [short description]
            - Staff Feedback: [detailed description]

            Example: 0|0|0|0|0|Sample short description.|Sample very long description. Can be multiple lines.
    
            Conversation history: 
            ${conversationHistory.conversationLog.map((message) => {
                return `${message.by === scenario.roles.modelRole ? 'You' : 'User'}: ${message.content}`;
            }).join('\n')}
        `;
    
        // Get the response from OpenAI
        const evaluation = await OpenAIChat.prompt(prompt, scenario, true);
        const evaluationContent = evaluation.content;
        
        console.log(evaluationContent)

        const evaluationData = evaluationContent.split('|');
    
        const listening = parseFloat(evaluationData[0]);
        const eq = parseFloat(evaluationData[1]);
        const tone = parseFloat(evaluationData[2]);
        const helpfulness = parseFloat(evaluationData[3]);
        const clarity = parseFloat(evaluationData[4]);

        const userFeedback = evaluationData[5] ? evaluationData[5] : "No user feedback.";
        const staffFeedback = evaluationData[6] ? evaluationData[6] : "No staff feedback.";

        // Return the extracted data
        return {
            scores: {
                listening: listening,
                emotionalIntelligence: eq,
                tone: tone,
                helpfulness: helpfulness,
                clarity: clarity
            },
            descriptions: {
                userFeedback,
                staffFeedback
            }
        };
    }

}



module.exports = OpenAIChat;