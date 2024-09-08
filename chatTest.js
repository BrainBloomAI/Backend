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






// async function runScenario(scenario, modelRole, userRole) {
//     let conversation = [];
//     const maxTries = 3;

//     // Generate the inital message
//     const initialMessage = await OpenAIChat.generateInitialMessage(scenario, modelRole);
//     conversation.push({ role: modelRole, content: initialMessage.content });
//     console.log(`${modelRole}: ${initialMessage.content}`);


//     // Main conversation loop
//     for (let loopCount = 1; loopCount <= 4; loopCount++) {
//         let tries = 0;
//         let isResponseValid = false;
//         let userResponse;

//         while (tries < maxTries && !isResponseValid) {
//             // Get user input and evaluate
//             userResponse = await getUserInput(`Your Response (${userRole}): `);

//             console.log(`this is the conversation: ${JSON.stringify(conversation)}`); // testing
//             isResponseValid = await OpenAIChat.evaluateResponse(scenario, conversation, userResponse.content);

//             if (!isResponseValid) {
//                 console.log("This response was not relevant. Try again.");
//             } else {
//                 conversation.push({ role: userRole, content: userResponse.content });
//                 break;
//             }
//             tries++;
//         }

//         // After the max tries for a response, generate ideal response and guide user
//         if (!isResponseValid) {
//             const idealResponse = await OpenAIChat.generateIdealResponse(scenario, conversation, userRole, modelRole);
//             console.log(`Here is the ideal resposne: "${idealResponse.content}"`);

//             let similarity = false;
//             while (!similarity) {
//                 userResponse = await getUserInput("Please repeat the ideal response: ");
//                 similarity = await OpenAIChat.checkResponseSimilarity(userResponse, idealResponse.content);
                
//                 if (!similarity) {
//                     console.log("Your response was not similar enough. Try again.");
//                 } else {
//                     console.log("Good job! Your response is now correct.");
//                 }
//             }
//             conversation.push({ role: userRole, content: userResponse.content });
//         }


//         // Generate the next message
//         if (loopCount < 4) {
//             const nextMessage = await OpenAIChat.generateNextMessage(scenario, conversation, modelRole);
//             console.log(`${modelRole}: ${nextMessage.content}`);
//             conversation.push({ role: modelRole, content: nextMessage.content });
//         } else {
//             // Final loop - generate the final message
//             const finalMessage = await OpenAIChat.generateFinalMessage(scenario, conversation, modelRole);
//             console.log(`${modelRole}: ${finalMessage.content}`);
//             conversation.push({ role: modelRole, content: finalMessage.content });
//         }
//     }


//     // Evaluate the entire conversation
//     const conversationEvaluation = await OpenAIChat.evaluateConversation(conversation, userRole);
//     console.log(`Conversation Evaluation: ${conversationEvaluation.content}`);
// }





// // TESTING

// // Define scenario and roles for testing
// const scenario = 'You are a customer in a retail store looking for a gift for a friend\'s birthday.';
// const modelRole = 'customer';
// const userRole = 'retail worker';

// // Run the scenario
// (async () => {
//     await runScenario(scenario, modelRole, userRole);
// })();


// // (async () => {
// //     const question = await getUserInput("Question: ");
// //     const answer = await OpenAIChat.prompt(question, false);
// //     console.log(`Answer: ${answer.content}`);
// // })();




// Sample scenario JSON
const scenario = {
    description: {
        tag: 'retail',
        name: 'helping customers in a retail environment',
        fullDescription: 'A customer in need of assistance asks for help for something. The retail worker should respond courteously and in an easy-to-understand manner.'
    },
    roles: {
        modelRole: 'customer',
        userRole: 'retail worker'
    }
};

// Sample conversation history JSON
let conversationHistory = {
    conversationLog: [
        {
            by: 'customer',
            content: 'Hi! I’m looking for a birthday gift for my friend, and I need some help finding something special.'
        },
        {
            by: 'retail worker',
            content: 'Sure! Can you tell me more about your friend?'
        },
        {
            by: 'customer',
            content: 'My friend loves her pet dog!'
        },
    ],
    targetAttempt: 'That is nice to hear, maybe I can suggest buying something for her dog?'
};


// Function to run the entire simulation
async function runSimulation() {
    try {
        console.log("Starting simulation...");

        // 1. Generate initial message for the scenario
        const initialMessage = await OpenAIChat.generateInitialMessage(scenario);
        console.log("Initial message from customer:", initialMessage);

    //     // Simulate adding initial message to conversation history
    //     conversationHistory.conversationHistory.push({
    //         by: scenario.roles.modelRole,
    //         content: initialMessage
    //     });

    //     // 2. Generate the ideal response from the retail worker (user role)
    //     const lastCustomerMessage = conversationHistory.conversationHistory.slice(-1)[0].content;
    //     const idealResponse = await OpenAIChat.generateIdealUserResponse(lastCustomerMessage, scenario);
    //     console.log("Ideal response from retail worker:", idealResponse);

    //     // 3. Evaluate if the user's targetAttempt is appropriate and relevant
    //     const isAppropriate = await OpenAIChat.evaluateUserResponse(
    //         conversationHistory.targetAttempt,
    //         lastCustomerMessage,
    //         scenario
    //     );
    //     console.log("Is user's target attempt appropriate?", isAppropriate);

    //     if (!isAppropriate) {
    //         console.log("User's target attempt is inappropriate. Prompting them to try again.");
    //         // Handle inappropriate response (e.g., allow retry, provide feedback, etc.)
    //     }

    //     // 4. Generate the next message from the customer (model role) based on the last retail worker message
    //     const nextCustomerMessage = await OpenAIChat.generateNextModelRoleMessage(conversationHistory, scenario);
    //     console.log("Next message from customer:", nextCustomerMessage);

    //     // Simulate adding the next customer message to conversation history
    //     conversationHistory.conversationHistory.push({
    //         by: scenario.roles.modelRole,
    //         content: nextCustomerMessage
    //     });

    //     // 5. Evaluate the entire conversation with metrics
    //     const conversationEvaluation = await OpenAIChat.evaluateConversation(conversationHistory, scenario.roles.userRole);
    //     console.log("Conversation Evaluation:", conversationEvaluation);

    } catch (error) {
        console.error("Error during simulation:", error);
    }
}

// Run the simulation
runSimulation();