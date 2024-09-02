// NOTE: THIS FILE IS IGNORED. IT IS MEANT TO SERVE AS A TEMPLATE FOR MODEL DEFINITIONS. ADD AND REMOVE PARTS AS NEEDED.
const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Template = sequelize.define('Template', {
        id: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        }
    }, { tableName: 'templates' });

    // Associations
    Template.associate = (models) => {
        
    }

    Template.hook = (models) => {
        
    }

    return Template;
}