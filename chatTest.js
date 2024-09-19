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





// Sample scenario JSON
const scenario = {
    description: {
        name: 'retail',
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
            content: 'Hi! Im looking for a birthday gift for my friend, and I need some help finding something special.'
        },
        {
            by: 'retail worker',
            content: 'Sure! Can you tell me more about your friend?'
        },
        {
            by: 'customer',
            content: 'My friend always goes on hikes'
        }
    ],
    targetAttempt: 'how about hiking geare'
};


async function testScenario(conversationHistory, scenario) {
    // console.log(scenario);
    // console.log('--- Step 1: Generate Initial Message ---');
    // const initialMessage = await OpenAIChat.generateInitialMessage(scenario);
    // console.log('Initial message from the customer: ', initialMessage.content);

    console.log('--- Step 2: Generate guided Response to Last Message ---');
    const guidedques = await OpenAIChat.generateGuidedQuestion(conversationHistory, scenario)
    console.log('guided response: ', guidedques.content)

    console.log('--- Step 3: Evaluate User Response ---');
    const evaluation = await OpenAIChat.evaluateResponse(conversationHistory, scenario);
    console.log('Is the user response appropriate? ', evaluation);

    console.log('--- Step 4: Generate Next Message from Customer ---');
    const nextMessage = await OpenAIChat.generateNextMessage(conversationHistory, scenario);
    console.log('Next message from the customer: ', nextMessage.content);

    console.log('--- Step 5: Evaluate the Conversation ---');
    const conversationEvaluation = await OpenAIChat.evaluateConversation(conversationHistory, scenario);
    console.log('Conversation evaluation: ', conversationEvaluation);
}

// Run the test
testScenario(conversationHistory, scenario).catch(console.error);