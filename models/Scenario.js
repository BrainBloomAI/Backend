const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Scenario = sequelize.define('Scenario', {
        scenarioID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        backgroundImage: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false
        },
        modelRole: {
            type: DataTypes.STRING,
            allowNull: false
        },
        userRole: {
            type: DataTypes.STRING,
            allowNull: false
        },
        created: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, { tableName: 'scenarios' });

    // Associations
    Scenario.associate = (models) => {
        Scenario.hasMany(models.Game, {
            foreignKey: {
                name: 'scenarioID',
                allowNull: false
            },
            as: 'games',
            onDelete: 'cascade'
        })
    }

    // Scenario.hook = (models) => {
        
    // }

    return Scenario;
}