const { Op } = require("sequelize");
const { OpenAIChat } = require("./services");
const readline = require('readline');
const { model } = require("./services/OpenAIChat");

OpenAIChat.initialise();

// temp function to get user input from console in a node.js environment
function getUserInput(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(query, answer => {
        rl.close();
        resolve(answer);
    }));
}

async function runScenario(scenario, modelRole, userRole) {
    let conversation = [];
    const maxTries = 3;

    // Generate the inital message
    const initialMessage = await OpenAIChat.generateInitialMessage(scenario, modelRole);
    conversation.push({ role: modelRole, content: initialMessage.content });
    console.log(`${modelRole}: ${initialMessage.content}`);


    // Main conversation loop
    for (let loopCount = 1; loopCount <= 4; loopCount++) {
        let tries = 0;
        let isResponseValid = false;
        let userResponse;

        while (tries < maxTries && !isResponseValid) {
            // Get user input and evaluate
            userResponse = await getUserInput(`Your Response (${userRole}): `);

            console.log(`this is the conversation: ${JSON.stringify(conversation)}`); // testing
            isResponseValid = await OpenAIChat.evaluateResponse(scenario, conversation, userResponse.content);

            if (!isResponseValid) {
                console.log("This response was not relevant. Try again.");
            } else {
                conversation.push({ role: userRole, content: userResponse.content });
                break;
            }
            tries++;
        }

        // After the max tries for a response, generate ideal response and guide user
        if (!isResponseValid) {
            const idealResponse = await OpenAIChat.generateIdealResponse(scenario, conversation, userRole, modelRole);
            console.log(`Here is the ideal resposne: "${idealResponse.content}"`);

            let similarity = false;
            while (!similarity) {
                userResponse = await getUserInput("Please repeat the ideal response: ");
                similarity = await OpenAIChat.checkResponseSimilarity(userResponse, idealResponse.content);
                
                if (!similarity) {
                    console.log("Your response was not similar enough. Try again.");
                } else {
                    console.log("Good job! Your response is now correct.");
                }
            }
            conversation.push({ role: userRole, content: userResponse.content });
        }


        // Generate the next message
        if (loopCount < 4) {
            const nextMessage = await OpenAIChat.generateNextMessage(scenario, conversation, modelRole);
            console.log(`${modelRole}: ${nextMessage.content}`);
            conversation.push({ role: modelRole, content: nextMessage.content });
        } else {
            // Final loop - generate the final message
            const finalMessage = await OpenAIChat.generateFinalMessage(scenario, conversation, modelRole);
            console.log(`${modelRole}: ${finalMessage.content}`);
            conversation.push({ role: modelRole, content: finalMessage.content });
        }
    }


    // Evaluate the entire conversation
    const conversationEvaluation = await OpenAIChat.evaluateConversation(conversation, userRole);
    console.log(`Conversation Evaluation: ${conversationEvaluation.content}`);
}





// TESTING

// Define scenario and roles for testing
const scenario = 'You are a customer in a retail store looking for a gift for a friend\'s birthday.';
const modelRole = 'customer';
const userRole = 'retail worker';

// Run the scenario
(async () => {
    await runScenario(scenario, modelRole, userRole);
})();


// (async () => {
//     const question = await getUserInput("Question: ");
//     const answer = await OpenAIChat.prompt(question, false);
//     console.log(`Answer: ${answer.content}`);
// })();