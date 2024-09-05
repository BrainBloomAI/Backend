const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const DialogueAttempt = sequelize.define('DialogueAttempt', {
        attemptID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        attemptNumber: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        content: {
            type: DataTypes.STRING,
            allowNull: false
        },
        successful: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        timestamp: {
            type: DataTypes.STRING,
            allowNull: false
        },
        timeTaken: {
            type: DataTypes.DOUBLE,
            allowNull: false
        }
    }, { tableName: 'dialogueAttempts' });

    // Associations
    DialogueAttempt.associate = (models) => {
        DialogueAttempt.belongsTo(models.GameDialogue, {
            foreignKey: 'dialogueID',
            as: 'dialogue'
        })
    }

    // DialogueAttempt.hook = (models) => {
        
    // }

    return DialogueAttempt;
}