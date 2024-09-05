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