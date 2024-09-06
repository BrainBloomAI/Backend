const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const GameDialogue = sequelize.define('GameDialogue', {
        dialogueID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        by: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['user', 'system']]
            }
        },
        attemptsCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, { tableName: 'gameDialogues' });

    // Associations
    GameDialogue.associate = (models) => {
        GameDialogue.belongsTo(models.Game, {
            foreignKey: "gameID",
            as: 'game'
        })

        GameDialogue.hasMany(models.DialogueAttempt, {
            foreignKey: {
                name: "dialogueID",
                allowNull: false
            },
            as: 'attempts',
            onDelete: 'cascade'
        })
    }

    // GameDialogue.hook = (models) => {
        
    // }

    return GameDialogue;
}