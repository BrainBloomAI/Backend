const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const GameEvaluation = sequelize.define('GameEvaluation', {
        evaluationID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        listening: {
            type: DataTypes.DOUBLE,
            allowNull: true
        },
        eq: {
            type: DataTypes.DOUBLE,
            allowNull: true
        },
        tone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        helpfulness: {
            type: DataTypes.DOUBLE,
            allowNull: true
        },
        clarity: {
            type: DataTypes.DOUBLE,
            allowNull: true
        },
        simpleDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        fullDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, { tableName: 'gameEvaluations' });

    // Associations
    GameEvaluation.associate = (models) => {
        GameEvaluation.belongsTo(models.Game, {
            foreignKey: 'associatedGameID',
            as: 'targetGame',
            onDelete: 'cascade'
        })
    }

    // GameEvaluation.hook = (models) => {
        
    // }

    return GameEvaluation;
}