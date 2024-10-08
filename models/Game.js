const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Game = sequelize.define('Game', {
        gameID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        startedTimestamp: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false
        },
        pointsEarned: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, { tableName: 'games' });

    // Associations
    Game.associate = (models) => {
        Game.belongsTo(models.Scenario, {
            foreignKey: "scenarioID",
            as: "scenario"
        })

        Game.belongsTo(models.User, {
            foreignKey: "userID",
            as: "user"
        })

        Game.hasMany(models.GameDialogue, {
            foreignKey: {
                name: "gameID",
                allowNull: false
            },
            as: "dialogues",
            onDelete: "cascade"
        })

        Game.hasOne(models.GameEvaluation, {
            foreignKey: {
                name: 'associatedGameID',
                allowNull: true
            },
            as: 'evaluation',
            onDelete: "cascade"
        })
    }

    // Game.hook = (models) => {
        
    // }

    return Game;
}