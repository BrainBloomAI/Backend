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
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        by: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['user', 'system']]
            }
        },
        responseDuration: {
            type: DataTypes.DOUBLE,
            allowNull: false
        },
        responseTimestamp: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, { tableName: 'gameDialogues' });

    // Associations
    GameDialogue.associate = (models) => {
        GameDialogue.belongsTo(models.Game, {
            foreignKey: 'gameID',
            as: 'game'
        })
    }

    // GameDialogue.hook = (models) => {
        
    // }

    return GameDialogue;
}