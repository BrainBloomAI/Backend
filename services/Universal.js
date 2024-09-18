const { v4: uuidv4 } = require('uuid');

/**
 * Universal class to store standardised data and functions.
 * 
 * @var data: Object - Data store
 * @var booted: boolean - Whether the class has been booted
 * @method generateUniqueID: Generate a unique ID. Default generation is with `uuid`. Provide custom length to generate a custom length ID. Provide an array of IDs to avoid in the `notIn` parameter (recommended if specifying custom length).
 */
class Universal {
    static data = {
        "defaultScenarios": {
            "Retail Customer Service": {
                name: "Retail Customer Service",
                backgroundImage: "retail.png",
                description: "An AI customer will ask for help when searching for something specific in a retail store. Learn to respond courteously and in an easy-to-understand manner as a retail worker in the store.",
                modelRole: 'customer',
                userRole: 'retail worker'
            },
            "Cafetaria Food Order": {
                name: "Cafetaria Food Order",
                backgroundImage: "cafetaria.png",
                description: "An AI customer will order food from you in a cafetaria. Understand the complexity of taking orders and responding as a vendor in the cafetaria.",
                modelRole: 'customer',
                userRole: 'vendor',
            },
            "Peer Conversation": {
                name: "Peer Conversation",
                backgroundImage: "peerconvo.png",
                description: "Talk to an AI peer from school about a random topic. Learn to engage in conversation and response naturally in peer-to-peer conversations.",
                modelRole: 'classmate',
                userRole: 'student',
            }
        }
    };
    static booted = false;
    
    static generateUniqueID(customLength=0, notIn=[]) {
        if (customLength == 0) {
            return uuidv4();
        } else {
            let id = ''
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            while (id.length == 0 || (notIn.length != 0 && notIn.includes(id))) {
                id = '';
                for (let i = 0; i < customLength; i++) {
                    id += characters.charAt(Math.floor(Math.random() * characters.length));
                }
            }

            return id;
        }
    }
}

module.exports = Universal;